import logger from '../libs/logger.js';
import LoyaltyEarningRule from '../models/LoyaltyEarningRule.model.js';
import LoyaltyCampaign from '../models/LoyaltyCampaign.model.js';
import LoyaltyLedgerEntry from '../models/LoyaltyLedgerEntry.model.js';
import Patient from '../models/Patient.model.js';
import Appointment from '../models/Appointment.model.js';
import LoyaltyTier, { PatientTierState } from '../models/LoyaltyTier.model.js';
import LoyaltyLedgerService from './LoyaltyLedgerService.js';
import { APPOINTMENT_STATUS } from '../enums/appointment.js';
import {
  LOYALTY_POINT_FORMULA_TYPE,
  LOYALTY_ROUNDING_RULE,
  LOYALTY_ELIGIBILITY,
  LOYALTY_ENTRY_TYPE,
  LOYALTY_EARNING_EVENT_LIST,
  LOYALTY_CAMPAIGN_STATUS,
} from '../enums/loyalty.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** One-time (never-repeat, no idempotencyKey needed) events per PRD E7/E10 — enforced by
 *  checking for any prior CREDIT entry on this patient+ruleCode rather than relying on the
 *  caller to always pass a stable idempotencyKey. */
const ONE_TIME_ONLY_RULE_CODES_CHECK_EVENTS = new Set(['APP_REGISTRATION', 'PROFILE_COMPLETION']);

/**
 * LOY-002/LOY-004 — resolves LoyaltyEarningRule versions active for a domain event into actual
 * ledger credits via LoyaltyLedgerService.credit(). This is the ONLY place rule eligibility/
 * caps/campaign-multiplier logic lives — callers (event listeners, jobs) just build a context
 * and call resolveAndCredit(). Never throws: this is invoked from event-driven paths (appointment
 * completion, invoice finalize, etc.) that must not fail because the loyalty program is off,
 * misconfigured, or errors out — every failure is caught, logged, and swallowed.
 */
class LoyaltyEarningEngineService {
  constructor() {
    this.ledgerService = new LoyaltyLedgerService();
  }

  /**
   * @param {string} eventType one of LOYALTY_EARNING_EVENT
   * @param {object} context
   *   patientId, branchId, occurredAt (Date, defaults now), amountInr, serviceId, packageId,
   *   sourceRefType, sourceRefId, idempotencyKey, organizationId, createdBy
   * @returns {Promise<Array>} the ledger entries actually created (empty array on no-op/error)
   */
  async resolveAndCredit(eventType, context = {}) {
    try {
      if (!LOYALTY_EARNING_EVENT_LIST.includes(eventType)) {
        logger.warn('LoyaltyEarningEngineService: unknown eventType, skipping', { eventType });
        return [];
      }
      if (!context?.patientId || !context?.branchId) {
        logger.warn('LoyaltyEarningEngineService: missing patientId/branchId, skipping', { eventType });
        return [];
      }

      try {
        await this.ledgerService.assertProgramEnabled();
      } catch {
        return []; // program disabled — silent no-op, never breaks the calling flow
      }

      const occurredAt = context.occurredAt ? new Date(context.occurredAt) : new Date();

      const rules = await LoyaltyEarningRule.find({ eventType, isActive: true, deletedAt: null });
      if (!rules.length) return [];

      const created = [];
      for (const rule of rules) {
        try {
          const entry = await this.#resolveRule(rule, occurredAt, context);
          if (entry) created.push(entry);
        } catch (err) {
          logger.error('LoyaltyEarningEngineService: rule resolution failed, skipping rule', {
            ruleCode: rule.ruleCode,
            eventType,
            message: err.message,
          });
        }
      }
      return created;
    } catch (err) {
      logger.error('LoyaltyEarningEngineService.resolveAndCredit failed', {
        eventType,
        message: err.message,
      });
      return [];
    }
  }

  /**
   * LOY-002 — DRY RUN. Runs the exact same computation pipeline as #resolveRule (formula →
   * rounding → campaign multiplier → caps → eligibility) but stops short of
   * LoyaltyLedgerService.credit(), so nothing is written anywhere. Powers the rule editor's
   * preview calculator (POST /loyalty/rules/preview).
   *
   * @param {object} args
   * @param {object} args.version a rule-version document/plain object (ruleVersionSchema shape)
   * @param {object} [args.context] { amountInr, patientId, branchId, serviceId, packageId }
   * @param {string} [args.ruleCode] used for the day/month/lifetime ledger cap lookups
   * @param {string} [args.eventType]
   * @param {Date|string} [args.occurredAt] defaults to now
   */
  async previewPoints({ version, context = {}, ruleCode = null, eventType = null, occurredAt } = {}) {
    if (!version) throw new Error('previewPoints requires a rule version');
    const at = occurredAt ? new Date(occurredAt) : new Date();
    // Stand-in for the persisted rule doc: only ruleCode/eventType are read downstream.
    const rule = { ruleCode: ruleCode || null, eventType: eventType || null };
    // With no patient to simulate against we cannot query their ledger history, so caps are
    // evaluated as if the patient had no prior accrual.
    const simulatePatient = Boolean(context.patientId);

    const rawPoints = this.computeRawPoints(version, context);
    const roundedPoints = this.round(rawPoints, version.roundingRule);

    let eligible = null;
    if (simulatePatient && context.branchId) {
      eligible = await this.isEligible(rule, version, context);
    }

    let afterCampaignMultiplier = roundedPoints;
    let campaign = null;
    if (roundedPoints > 0) {
      const boosted = await this.applyCampaignMultiplierDetailed(rule, version, context, roundedPoints, at);
      afterCampaignMultiplier = boosted.points;
      campaign = boosted.campaign;
    }

    let afterTierMultiplier = afterCampaignMultiplier;
    let tier = null;
    if (afterCampaignMultiplier > 0 && simulatePatient) {
      const tiered = await this.applyTierMultiplierDetailed(version, context, afterCampaignMultiplier);
      afterTierMultiplier = tiered.points;
      tier = tiered.tier;
    }

    let afterCaps = afterTierMultiplier;
    let capBound = null;
    let capsEvaluated = [];
    if (afterTierMultiplier > 0) {
      const cappedResult = await this.applyCapsDetailed(rule, version, context, afterTierMultiplier, at, {
        assumeNoPriorAccrual: !(simulatePatient && ruleCode),
      });
      afterCaps = cappedResult.points;
      capBound = cappedResult.capBound;
      capsEvaluated = cappedResult.capsEvaluated;
    }

    const blockedBy = eligible === false ? 'ELIGIBILITY' : null;
    const finalPoints = blockedBy ? 0 : afterCaps;

    return {
      dryRun: true,
      persisted: false,
      note: 'Dry run computed by LoyaltyEarningEngineService.previewPoints — no ledger entry, rule or version was written.',
      amountInr: Number(context.amountInr) || 0,
      occurredAt: at,
      rawPoints,
      roundedPoints,
      afterCampaignMultiplier,
      afterTierMultiplier,
      afterCaps,
      finalPoints,
      campaignApplied: Boolean(campaign),
      campaign,
      tierMultiplierApplied: Boolean(tier),
      tier,
      capApplied: Boolean(capBound),
      capBound,
      capsEvaluated,
      eligibility: {
        // null = not simulated (no patientId/branchId supplied), so eligibility was not evaluated.
        eligible,
        simulated: eligible !== null,
        rule: version.eligibility || 'ALL_PATIENTS',
      },
      capsSimulatedAgainstLedger: Boolean(simulatePatient && ruleCode),
      blockedBy,
    };
  }

  async #resolveRule(rule, occurredAt, context) {
    const version = rule.activeVersionAt(occurredAt);
    if (!version) return null;

    if (!(await this.isEligible(rule, version, context))) return null;

    // One-time-only events (E7/E10) — never double-award even without an idempotencyKey.
    if (ONE_TIME_ONLY_RULE_CODES_CHECK_EVENTS.has(rule.eventType)) {
      const already = await LoyaltyLedgerEntry.exists({
        patientId: context.patientId,
        ruleCode: rule.ruleCode,
        entryType: LOYALTY_ENTRY_TYPE.CREDIT,
      });
      if (already) return null;
    }

    let points = this.computePoints(version, context);
    if (points <= 0) return null;

    points = await this.applyCampaignMultiplier(rule, version, context, points, occurredAt);
    if (points <= 0) return null;

    points = await this.applyTierMultiplier(version, context, points);
    if (points <= 0) return null;

    points = await this.applyCaps(rule, version, context, points, occurredAt);
    if (points <= 0) return null;

    return this.ledgerService.credit({
      branchId: context.branchId,
      patientId: context.patientId,
      points,
      entryType: LOYALTY_ENTRY_TYPE.CREDIT,
      ruleCode: rule.ruleCode,
      ruleVersionId: version._id,
      sourceRefType: context.sourceRefType || null,
      sourceRefId: context.sourceRefId || null,
      idempotencyKey: context.idempotencyKey || null,
      organizationId: context.organizationId || null,
      createdBy: context.createdBy || null,
      actorReq: context.actorReq || null,
    });
  }

  // ---- Eligibility ----------------------------------------------------

  async isEligible(rule, version, context) {
    if (version.branchIds?.length && !version.branchIds.some((b) => b.toString() === String(context.branchId))) {
      return false;
    }
    if (version.serviceIds?.length && context.serviceId) {
      if (!version.serviceIds.some((s) => s.toString() === String(context.serviceId))) return false;
    }
    if (version.packageIds?.length && context.packageId) {
      if (!version.packageIds.some((p) => p.toString() === String(context.packageId))) return false;
    }
    if (version.serviceIds?.length && !context.serviceId && version.packageIds?.length === 0) {
      // Rule scoped to specific services but the event carries none — cannot match.
      return false;
    }

    if (version.requiresMarketingConsent) {
      const patient = await Patient.findById(context.patientId).select('consent createdAt').lean();
      if (!patient?.consent?.marketingConsent) return false;
    }

    switch (version.eligibility) {
      case LOYALTY_ELIGIBILITY.ALL_PATIENTS:
        return true;
      case LOYALTY_ELIGIBILITY.NEW_PATIENTS_ONLY: {
        const priorCompletedVisits = await Appointment.countDocuments({
          patientId: context.patientId,
          status: APPOINTMENT_STATUS.COMPLETED,
          _id: { $ne: context.sourceRefId || null },
        });
        return priorCompletedVisits === 0;
      }
      case LOYALTY_ELIGIBILITY.MINIMUM_VISITS: {
        const visitCount = await Appointment.countDocuments({
          patientId: context.patientId,
          status: APPOINTMENT_STATUS.COMPLETED,
        });
        return visitCount >= (version.minimumVisits || 0);
      }
      case LOYALTY_ELIGIBILITY.SPECIFIC_TIER: {
        // The rule schema does not carry a specific target tierId (LOY-002 gap) — best-effort
        // interpretation: the patient must currently hold *some* qualifying tier.
        const tierState = await PatientTierState.findOne({ patientId: context.patientId }).lean();
        return Boolean(tierState?.currentTierId);
      }
      default:
        return true;
    }
  }

  // ---- Point computation -----------------------------------------------

  /** Unrounded formula output. Split out of computePoints() so the dry-run preview can report the
   *  raw value alongside the rounded one — the arithmetic is byte-for-byte what it always was. */
  /**
   * LOY-002 `branchOverrides` — a rule can award a different pointValue at a specific branch
   * (e.g. a new clinic running a richer rate) without forking the rule into per-branch copies.
   * Only pointValue is overridable; caps, eligibility and formula shape stay global to the rule.
   */
  effectivePointValue(version, context = {}) {
    const overrides = version?.branchOverrides;
    if (!overrides || !context.branchId) return version.pointValue;
    const key = String(context.branchId);
    const override = typeof overrides.get === 'function' ? overrides.get(key) : overrides[key];
    const value = Number(override?.pointValue);
    return Number.isFinite(value) && value >= 0 ? value : version.pointValue;
  }

  computeRawPoints(version, context) {
    const pointValue = this.effectivePointValue(version, context);
    let raw = 0;
    switch (version.formulaType) {
      case LOYALTY_POINT_FORMULA_TYPE.FIXED:
        raw = pointValue;
        break;
      case LOYALTY_POINT_FORMULA_TYPE.PER_AMOUNT: {
        const amount = Number(context.amountInr) || 0;
        const perAmount = version.perAmountInr || 1;
        raw = (amount / perAmount) * pointValue;
        break;
      }
      case LOYALTY_POINT_FORMULA_TYPE.PERCENT_OF_AMOUNT: {
        const amount = Number(context.amountInr) || 0;
        raw = (amount * pointValue) / 100;
        break;
      }
      default:
        raw = 0;
    }
    return raw;
  }

  computePoints(version, context) {
    return this.round(this.computeRawPoints(version, context), version.roundingRule);
  }

  round(value, roundingRule) {
    if (!Number.isFinite(value) || value <= 0) return 0;
    switch (roundingRule) {
      case LOYALTY_ROUNDING_RULE.CEILING:
        return Math.ceil(value);
      case LOYALTY_ROUNDING_RULE.ROUND:
        return Math.round(value);
      case LOYALTY_ROUNDING_RULE.FLOOR:
      default:
        return Math.floor(value);
    }
  }

  // ---- Campaign multiplier (E11) ---------------------------------------

  async applyCampaignMultiplier(rule, version, context, points, occurredAt) {
    return (await this.applyCampaignMultiplierDetailed(rule, version, context, points, occurredAt)).points;
  }

  /**
   * Same lookup/branch/service gating and rounding as before, but reports *which* campaign (if any)
   * moved the number so the preview calculator can show it. Every `return points` in the original
   * becomes `{ points, campaign: null }` — no arithmetic or query changed.
   */
  async applyCampaignMultiplierDetailed(rule, version, context, points, occurredAt) {
    const campaign = await LoyaltyCampaign.findOne({
      status: LOYALTY_CAMPAIGN_STATUS.ACTIVE,
      startDate: { $lte: occurredAt },
      endDate: { $gte: occurredAt },
      $or: [{ appliesToRuleCodes: { $size: 0 } }, { appliesToRuleCodes: rule.ruleCode }],
    }).lean();
    if (!campaign) return { points, campaign: null };

    if (campaign.branchIds?.length && !campaign.branchIds.some((b) => b.toString() === String(context.branchId))) {
      return { points, campaign: null };
    }
    if (campaign.serviceIds?.length && context.serviceId) {
      if (!campaign.serviceIds.some((s) => s.toString() === String(context.serviceId))) {
        return { points, campaign: null };
      }
    }

    // LOY-013 audience targeting. A campaign scoped to a segment must NOT boost everyone: an
    // unenforced segment silently converts a "Gold members only" double-points week into a
    // clinic-wide one, which is a real money leak. Non-matching patient => no multiplier.
    if (campaign.audienceSegment && !(await this.matchesAudienceSegment(campaign.audienceSegment, context))) {
      return { points, campaign: null };
    }

    const boosted = points * (campaign.multiplier || 1);
    return {
      points: this.round(boosted, version.roundingRule),
      campaign: {
        id: campaign._id.toString(),
        name: campaign.name,
        multiplier: campaign.multiplier || 1,
      },
    };
  }

  // ---- Tier multiplier (E12 / LOY-012) ---------------------------------

  async applyTierMultiplier(version, context, points) {
    return (await this.applyTierMultiplierDetailed(version, context, points)).points;
  }

  /**
   * LOY-012 — a patient's tier carries an `earningMultiplier` that, until now, was stored and
   * displayed but never actually applied to an accrual. Applied AFTER the campaign multiplier
   * and BEFORE the caps, so a rule's perEvent/perDay ceilings still bound the boosted figure —
   * a tier can earn a patient points faster, never past the rule's stated maximum.
   * No-op unless the program has tiers switched on (LoyaltyProgramSettings.tiersEnabled).
   */
  /**
   * LOY-013 — resolves a campaign's free-text `audienceSegment` tag against the segmentation the
   * rest of the system already carries for a patient:
   *   - `Patient.tags` (the CRM/offer-board segment tags reception applies), and
   *   - the patient's current loyalty tier name (so "Gold" targets Gold members).
   * Matching is case-insensitive and trimmed, because these tags are typed by hand in two
   * different screens.
   *
   * Fails CLOSED: with no patient to evaluate (e.g. an anonymous preview), a segment-targeted
   * campaign does not apply. Over-crediting is unrecoverable money; under-crediting is a
   * support ticket.
   */
  async matchesAudienceSegment(audienceSegment, context = {}) {
    const wanted = String(audienceSegment || '').trim().toLowerCase();
    if (!wanted) return true; // untargeted campaign — applies to everyone
    if (!context.patientId) return false;

    const patient = await Patient.findById(context.patientId).select('tags').lean();
    const tags = (patient?.tags || []).map((t) => String(t).trim().toLowerCase());
    if (tags.includes(wanted)) return true;

    const state = await PatientTierState.findOne({ patientId: context.patientId })
      .select('currentTierId')
      .lean();
    if (!state?.currentTierId) return false;
    const tier = await LoyaltyTier.findById(state.currentTierId).select('name').lean();
    return String(tier?.name || '').trim().toLowerCase() === wanted;
  }

  async applyTierMultiplierDetailed(version, context, points) {
    const settings = await this.ledgerService.getSettings();
    if (!settings?.tiersEnabled || !context.patientId) return { points, tier: null };

    const state = await PatientTierState.findOne({ patientId: context.patientId })
      .select('currentTierId')
      .lean();
    if (!state?.currentTierId) return { points, tier: null };

    const tier = await LoyaltyTier.findById(state.currentTierId).select('name earningMultiplier').lean();
    const multiplier = Number(tier?.earningMultiplier) || 1;
    if (multiplier === 1) return { points, tier: null };

    return {
      points: this.round(points * multiplier, version.roundingRule),
      tier: { id: tier._id.toString(), name: tier.name, earningMultiplier: multiplier },
    };
  }

  // ---- Caps (perEvent/perDay/perMonth/lifetime) ------------------------

  async applyCaps(rule, version, context, points, occurredAt) {
    return (await this.applyCapsDetailed(rule, version, context, points, occurredAt)).points;
  }

  /**
   * Identical cap pipeline to the original #applyCaps — same order, same Math.min semantics, same
   * early `0` returns, same final Math.max(0, Math.floor()) — additionally recording which bound
   * actually clamped the value for the preview breakdown.
   *
   * @param {object} [options]
   * @param {boolean} [options.assumeNoPriorAccrual] preview-only: treat the day/month/lifetime
   *   ledger totals as 0 (i.e. simulate a patient with no history) instead of querying. Never set
   *   by the live resolveAndCredit path.
   */
  async applyCapsDetailed(rule, version, context, points, occurredAt, options = {}) {
    let capped = points;
    let capBound = null;
    const capsEvaluated = [];

    const bind = (cap, limit) => {
      capsEvaluated.push({ cap, limit });
      if (limit < capped) {
        capped = limit;
        capBound = cap;
      }
    };
    const roomFor = async (cap, range) =>
      options.assumeNoPriorAccrual ? cap : this.#remainingRoom(context.patientId, rule.ruleCode, cap, range);

    if (version.perEventCap != null) {
      bind('PER_EVENT', version.perEventCap);
    }
    if (capped <= 0) return { points: 0, capBound, capsEvaluated };

    if (version.perDayCap != null) {
      bind(
        'PER_DAY',
        await roomFor(version.perDayCap, {
          $gte: this.#startOfDay(occurredAt),
          $lt: this.#startOfDay(occurredAt, 1),
        })
      );
    }
    if (capped <= 0) return { points: 0, capBound, capsEvaluated };

    if (version.perMonthCap != null) {
      bind(
        'PER_MONTH',
        await roomFor(version.perMonthCap, {
          $gte: this.#startOfMonth(occurredAt),
          $lt: this.#startOfMonth(occurredAt, 1),
        })
      );
    }
    if (capped <= 0) return { points: 0, capBound, capsEvaluated };

    if (version.lifetimeCap != null) {
      bind('LIFETIME', await roomFor(version.lifetimeCap, null));
    }

    return { points: Math.max(0, Math.floor(capped)), capBound, capsEvaluated };
  }

  async #remainingRoom(patientId, ruleCode, cap, createdAtRange) {
    const match = {
      patientId,
      ruleCode,
      entryType: LOYALTY_ENTRY_TYPE.CREDIT,
    };
    if (createdAtRange) match.createdAt = createdAtRange;
    const rows = await LoyaltyLedgerEntry.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: '$points' } } },
    ]);
    const already = rows[0]?.total || 0;
    return Math.max(0, cap - already);
  }

  #startOfDay(date, addDays = 0) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (addDays) d.setTime(d.getTime() + addDays * MS_PER_DAY);
    return d;
  }

  #startOfMonth(date, addMonths = 0) {
    const d = new Date(date);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    if (addMonths) d.setMonth(d.getMonth() + addMonths);
    return d;
  }
}

export default LoyaltyEarningEngineService;
