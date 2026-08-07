import logger from '../libs/logger.js';
import LoyaltyEarningRule from '../models/LoyaltyEarningRule.model.js';
import LoyaltyCampaign from '../models/LoyaltyCampaign.model.js';
import LoyaltyLedgerEntry from '../models/LoyaltyLedgerEntry.model.js';
import Patient from '../models/Patient.model.js';
import Appointment from '../models/Appointment.model.js';
import { PatientTierState } from '../models/LoyaltyTier.model.js';
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

  async #resolveRule(rule, occurredAt, context) {
    const version = rule.activeVersionAt(occurredAt);
    if (!version) return null;

    if (!(await this.#isEligible(rule, version, context))) return null;

    // One-time-only events (E7/E10) — never double-award even without an idempotencyKey.
    if (ONE_TIME_ONLY_RULE_CODES_CHECK_EVENTS.has(rule.eventType)) {
      const already = await LoyaltyLedgerEntry.exists({
        patientId: context.patientId,
        ruleCode: rule.ruleCode,
        entryType: LOYALTY_ENTRY_TYPE.CREDIT,
      });
      if (already) return null;
    }

    let points = this.#computePoints(version, context);
    if (points <= 0) return null;

    points = await this.#applyCampaignMultiplier(rule, version, context, points, occurredAt);
    if (points <= 0) return null;

    points = await this.#applyCaps(rule, version, context, points, occurredAt);
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

  async #isEligible(rule, version, context) {
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

  #computePoints(version, context) {
    let raw = 0;
    switch (version.formulaType) {
      case LOYALTY_POINT_FORMULA_TYPE.FIXED:
        raw = version.pointValue;
        break;
      case LOYALTY_POINT_FORMULA_TYPE.PER_AMOUNT: {
        const amount = Number(context.amountInr) || 0;
        const perAmount = version.perAmountInr || 1;
        raw = (amount / perAmount) * version.pointValue;
        break;
      }
      case LOYALTY_POINT_FORMULA_TYPE.PERCENT_OF_AMOUNT: {
        const amount = Number(context.amountInr) || 0;
        raw = (amount * version.pointValue) / 100;
        break;
      }
      default:
        raw = 0;
    }
    return this.#round(raw, version.roundingRule);
  }

  #round(value, roundingRule) {
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

  async #applyCampaignMultiplier(rule, version, context, points, occurredAt) {
    const campaign = await LoyaltyCampaign.findOne({
      status: LOYALTY_CAMPAIGN_STATUS.ACTIVE,
      startDate: { $lte: occurredAt },
      endDate: { $gte: occurredAt },
      $or: [{ appliesToRuleCodes: { $size: 0 } }, { appliesToRuleCodes: rule.ruleCode }],
    }).lean();
    if (!campaign) return points;

    if (campaign.branchIds?.length && !campaign.branchIds.some((b) => b.toString() === String(context.branchId))) {
      return points;
    }
    if (campaign.serviceIds?.length && context.serviceId) {
      if (!campaign.serviceIds.some((s) => s.toString() === String(context.serviceId))) return points;
    }

    const boosted = points * (campaign.multiplier || 1);
    return this.#round(boosted, version.roundingRule);
  }

  // ---- Caps (perEvent/perDay/perMonth/lifetime) ------------------------

  async #applyCaps(rule, version, context, points, occurredAt) {
    let capped = points;
    if (version.perEventCap != null) {
      capped = Math.min(capped, version.perEventCap);
    }
    if (capped <= 0) return 0;

    if (version.perDayCap != null) {
      const room = await this.#remainingRoom(context.patientId, rule.ruleCode, version.perDayCap, {
        $gte: this.#startOfDay(occurredAt),
        $lt: this.#startOfDay(occurredAt, 1),
      });
      capped = Math.min(capped, room);
    }
    if (capped <= 0) return 0;

    if (version.perMonthCap != null) {
      const room = await this.#remainingRoom(context.patientId, rule.ruleCode, version.perMonthCap, {
        $gte: this.#startOfMonth(occurredAt),
        $lt: this.#startOfMonth(occurredAt, 1),
      });
      capped = Math.min(capped, room);
    }
    if (capped <= 0) return 0;

    if (version.lifetimeCap != null) {
      const room = await this.#remainingRoom(context.patientId, rule.ruleCode, version.lifetimeCap, null);
      capped = Math.min(capped, room);
    }

    return Math.max(0, Math.floor(capped));
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
