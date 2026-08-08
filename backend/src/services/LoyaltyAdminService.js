import mongoose from 'mongoose';
import ApiError from '../libs/ApiError.js';
import AuditService from './AuditService.js';
import LoyaltyLedgerService from './LoyaltyLedgerService.js';
import LoyaltyEarningEngineService from './LoyaltyEarningEngineService.js';
import { eventBus } from '../events/eventBus.js';
import LoyaltyProgramSettings from '../models/LoyaltyProgramSettings.model.js';
import LoyaltyEarningRule from '../models/LoyaltyEarningRule.model.js';
import LoyaltyCampaign from '../models/LoyaltyCampaign.model.js';
import LoyaltyLedgerEntry from '../models/LoyaltyLedgerEntry.model.js';
import LoyaltyAdjustmentRequest from '../models/LoyaltyAdjustmentRequest.model.js';
import LoyaltyTier, { PatientTierState } from '../models/LoyaltyTier.model.js';
import Patient from '../models/Patient.model.js';
import { hasAnyPermission } from '../helpers/permission.helper.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { ROLES } from '../constants/roles.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import {
  LOYALTY_ADJUSTMENT_STATUS,
  LOYALTY_CAMPAIGN_STATUS,
  LOYALTY_ENTRY_TYPE,
  LOYALTY_EVENTS,
} from '../enums/loyalty.js';

/**
 * LOY-002/008/009/012/013/014 — admin configuration surface for the loyalty program. The
 * engine (LoyaltyEarningEngineService) and ledger (LoyaltyLedgerService) already implement the
 * runtime behaviour these settings/rules drive; this service is purely CRUD + the manual
 * adjustment approval workflow on top of the models they read.
 */
class LoyaltyAdminService {
  constructor() {
    this.ledgerService = new LoyaltyLedgerService();
    this.auditService = new AuditService();
    // Read-only here: used only for the rule preview dry run (previewRuleVersion).
    this.engineService = new LoyaltyEarningEngineService();
  }

  // ---- LOY-001: Program settings (versioned) ---------------------------

  /** Returns schema defaults (unsaved, version 0) when no settings doc exists yet, so the admin
   *  settings form always has something to render instead of a blank page. */
  async getSettings() {
    const settings = await LoyaltyProgramSettings.findOne().sort({ effectiveFrom: -1 });
    if (settings) return settings.toSafeObject();
    return new LoyaltyProgramSettings({ version: 0 }).toSafeObject({ isDefault: true });
  }

  async updateSettings(payload, actorId, req) {
    const current = await LoyaltyProgramSettings.findOne().sort({ effectiveFrom: -1 });
    // A cleared form field arrives as null/'' and must mean "leave unchanged" rather than
    // overwriting a required setting with null (which the model would then reject).
    const patch = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== null && v !== '')
    );
    const next = new LoyaltyProgramSettings({
      ...(current ? current.toObject() : {}),
      ...patch,
      _id: undefined,
      version: (current?.version || 0) + 1,
      previousVersionId: current?._id || null,
      effectiveFrom: patch.effectiveFrom ? new Date(patch.effectiveFrom) : new Date(),
      createdBy: actorId,
      createdAt: undefined,
      updatedAt: undefined,
    });
    await next.save();

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_SETTINGS_UPDATED, {
      actorId,
      req,
      resourceType: 'LoyaltyProgramSettings',
      resourceId: next._id,
      metadata: { version: next.version },
    });

    return next.toSafeObject();
  }

  // ---- LOY-002: Earning rules -------------------------------------------

  async listRules({ eventType, isActive } = {}) {
    const query = { deletedAt: null };
    if (eventType) query.eventType = eventType;
    if (isActive !== undefined) query.isActive = isActive;
    const rules = await LoyaltyEarningRule.find(query).sort({ createdAt: -1 });
    return rules.map((r) => r.toSafeObject());
  }

  async getRule(id) {
    const rule = await LoyaltyEarningRule.findOne({ _id: id, deletedAt: null });
    if (!rule) throw ApiError.notFound('Loyalty rule not found');
    return rule.toSafeObject();
  }

  async createRule(payload, actorId, req) {
    const { ruleCode, eventType, name, notes, isActive, version } = payload;
    const exists = await LoyaltyEarningRule.findOne({ ruleCode: ruleCode.toUpperCase() });
    if (exists) throw ApiError.conflict('A rule with this ruleCode already exists');

    const rule = await LoyaltyEarningRule.create({
      ruleCode,
      eventType,
      name,
      notes: notes || null,
      isActive: isActive ?? true,
      versions: [
        {
          ...version,
          effectiveFrom: version?.effectiveFrom ? new Date(version.effectiveFrom) : new Date(),
          createdBy: actorId,
        },
      ],
    });

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_RULE_CREATED, {
      actorId,
      req,
      resourceType: 'LoyaltyEarningRule',
      resourceId: rule._id,
      metadata: { ruleCode: rule.ruleCode, eventType: rule.eventType },
    });

    return rule.toSafeObject();
  }

  /** Does the actor behind `req` hold the loyalty approval authority (owner/manager)? */
  #isApprover(req) {
    return (
      req?.auth?.role === ROLES.OWNER ||
      hasAnyPermission(req?.auth?.permissions || [], [PERMISSIONS.LOYALTY_ADJUST_APPROVE])
    );
  }

  /**
   * LOY-001 `ruleChangeApprovalThresholdPercent` — a rule edit that moves pointValue by more
   * than the configured percentage of its current value is a liability event, so it may only be
   * made by someone who also holds approval authority. Anyone else is refused and has to route
   * the change through an owner/manager. Returns true when the change WAS above the threshold
   * and the actor's own approval is therefore what let it through — recorded on the version.
   */
  async #assertRuleChangeApproval(rule, versionPayload, req) {
    const settings = await this.ledgerService.getSettings();
    const threshold = settings?.ruleChangeApprovalThresholdPercent;
    if (threshold == null) return false;

    const current = rule.activeVersionAt(new Date());
    const from = Number(current?.pointValue);
    const to = Number(versionPayload?.pointValue);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false;

    // A change away from a zero baseline has no meaningful percentage — treat any non-zero move
    // as unbounded rather than silently exempting it.
    const deltaPercent = from === 0 ? (to === 0 ? 0 : Infinity) : (Math.abs(to - from) / from) * 100;
    if (deltaPercent <= threshold) return false;

    if (!this.#isApprover(req)) {
      throw ApiError.forbidden(
        `This changes the rule's point value by ${deltaPercent === Infinity ? 'more than' : `${Math.round(deltaPercent)}%, above`} the ${threshold}% approval threshold — it requires owner/manager approval.`
      );
    }
    return true;
  }

  /** Adds a new effective-dated version, closing the currently-open version's effectiveTo. */
  async addRuleVersion(id, versionPayload, actorId, req) {
    const rule = await LoyaltyEarningRule.findOne({ _id: id, deletedAt: null });
    if (!rule) throw ApiError.notFound('Loyalty rule not found');

    const neededApproval = await this.#assertRuleChangeApproval(rule, versionPayload, req);

    const effectiveFrom = versionPayload.effectiveFrom ? new Date(versionPayload.effectiveFrom) : new Date();
    const openVersion = rule.versions.find((v) => !v.effectiveTo);
    if (openVersion) openVersion.effectiveTo = effectiveFrom;

    rule.versions.push({
      ...versionPayload,
      effectiveFrom,
      createdBy: actorId,
      approvedBy: neededApproval ? actorId : null,
      approvedAt: neededApproval ? new Date() : null,
    });
    await rule.save();

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_RULE_VERSION_ADDED, {
      actorId,
      req,
      resourceType: 'LoyaltyEarningRule',
      resourceId: rule._id,
      metadata: { ruleCode: rule.ruleCode, effectiveFrom, aboveApprovalThreshold: neededApproval },
    });

    return rule.toSafeObject();
  }

  /**
   * LOY-002 preview calculator — DRY RUN, writes nothing. Casts the draft through the real
   * LoyaltyEarningRule schema (an unsaved doc, purely for casting + defaults such as
   * roundingRule=FLOOR and empty id arrays) and hands the resulting version to the earning
   * engine's previewPoints(), so the numbers an admin sees come from the same code path that
   * credits points at runtime rather than a reimplementation.
   */
  async previewRuleVersion(payload = {}) {
    const {
      amountInr = 0,
      ruleCode,
      eventType,
      patientId,
      branchId,
      serviceId,
      packageId,
      occurredAt,
      ...versionDraft
    } = payload;

    // Not persisted: constructed only so mongoose applies ruleVersionSchema casting/defaults.
    const probe = new LoyaltyEarningRule({
      ruleCode: ruleCode || 'PREVIEW',
      eventType: eventType || 'CUSTOM',
      name: 'Preview (not saved)',
      versions: [
        {
          ...versionDraft,
          effectiveFrom: versionDraft.effectiveFrom ? new Date(versionDraft.effectiveFrom) : new Date(),
        },
      ],
    });
    const invalid = probe.validateSync();
    if (invalid) {
      throw ApiError.badRequest(`Invalid rule draft: ${invalid.message}`);
    }

    const preview = await this.engineService.previewPoints({
      version: probe.versions[0],
      ruleCode: ruleCode || null,
      eventType: eventType || null,
      occurredAt,
      context: {
        amountInr,
        patientId: patientId || null,
        branchId: branchId || null,
        serviceId: serviceId || null,
        packageId: packageId || null,
      },
    });

    // Surfaced so the editor can warn that a correct-looking rule would still award nothing today.
    let programEnabled = true;
    try {
      await this.ledgerService.assertProgramEnabled();
    } catch {
      programEnabled = false;
    }

    return { ...preview, programEnabled };
  }

  // ---- LOY-012: Tiers -----------------------------------------------------

  async listTiers() {
    const tiers = await LoyaltyTier.find({ isActive: true }).sort({ rank: 1 });
    return tiers.map((t) => t.toSafeObject());
  }

  async upsertTier(id, payload) {
    if (id) {
      const tier = await LoyaltyTier.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
      if (!tier) throw ApiError.notFound('Loyalty tier not found');
      return tier.toSafeObject();
    }
    const tier = await LoyaltyTier.create(payload);
    return tier.toSafeObject();
  }

  async getPatientTierProgress(patientId) {
    const [state, tiers] = await Promise.all([
      PatientTierState.findOne({ patientId }),
      LoyaltyTier.find({ isActive: true }).sort({ rank: 1 }),
    ]);
    const currentTier = state?.currentTierId
      ? tiers.find((t) => t._id.toString() === state.currentTierId.toString())
      : null;
    const nextTier = tiers.find((t) => t.rank > (currentTier?.rank ?? -1)) || null;

    // Which rolling counter the next tier is measured against, so the UI can render one
    // progress bar without knowing each tier's qualificationBasis.
    const basisValue = {
      POINTS_EARNED_ROLLING_12M: state?.rollingPointsEarned,
      VISITS_COUNT_ROLLING_12M: state?.rollingVisitsCount,
      SPEND_ROLLING_12M: state?.rollingSpend,
    };

    return {
      currentTier: currentTier ? currentTier.toSafeObject() : null,
      nextTier: nextTier ? nextTier.toSafeObject() : null,
      progressValue: nextTier ? basisValue[nextTier.qualificationBasis] ?? 0 : null,
      progress: state
        ? {
            rollingPointsEarned: state.rollingPointsEarned,
            rollingVisitsCount: state.rollingVisitsCount,
            rollingSpend: state.rollingSpend,
            tierSince: state.tierSince,
          }
        : null,
    };
  }

  // ---- LOY-013: Campaigns --------------------------------------------------

  async listCampaigns({ status } = {}) {
    const query = {};
    if (status) query.status = status;
    const campaigns = await LoyaltyCampaign.find(query).sort({ startDate: -1 });
    return campaigns.map((c) => c.toSafeObject());
  }

  async createCampaign(payload, actorId, req) {
    const campaign = await LoyaltyCampaign.create({ ...payload, createdBy: actorId });

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_CAMPAIGN_CREATED, {
      actorId,
      req,
      resourceType: 'LoyaltyCampaign',
      resourceId: campaign._id,
      metadata: { name: campaign.name, multiplier: campaign.multiplier },
    });

    return campaign.toSafeObject();
  }

  async updateCampaignStatus(id, status, actorId, req) {
    const campaign = await LoyaltyCampaign.findById(id);
    if (!campaign) throw ApiError.notFound('Loyalty campaign not found');

    campaign.status = status;
    if (status === 'ACTIVE' && !campaign.approvedBy) {
      campaign.approvedBy = actorId;
      campaign.approvedAt = new Date();
    }
    await campaign.save();

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_CAMPAIGN_STATUS_CHANGED, {
      actorId,
      req,
      resourceType: 'LoyaltyCampaign',
      resourceId: campaign._id,
      metadata: { status },
    });

    return campaign.toSafeObject();
  }

  // ---- LOY-008: Manual adjustments + approval queue ------------------------

  /** LoyaltyLedgerService.manualAdjustment returns a single entry for CREDIT (it delegates to
   *  credit()) but an array of FIFO-consumed lots for DEBIT — normalise so callers can always
   *  treat the result as a list. */
  #asEntryList(result) {
    return Array.isArray(result) ? result : [result];
  }

  async #resolvePatientBranchId(patientId) {
    const patient = await Patient.findById(patientId).select('primaryBranchId').lean();
    return patient?.primaryBranchId || null;
  }

  /**
   * LOY-008 — the requester's own numeric authority for a manual adjustment, from
   * LoyaltyProgramSettings.manualAdjustmentPointLimitsByRole. null = no limit configured for
   * that role. This is what makes "exceeds the requester's own limit" (the wording the approval
   * notification has always used) an actual enforced number rather than a figure of speech.
   */
  async #manualAdjustmentLimitFor(role) {
    if (!role) return null;
    const settings = await this.ledgerService.getSettings();
    const limits = settings?.manualAdjustmentPointLimitsByRole;
    if (!limits) return null;
    const limit = limits instanceof Map ? limits.get(role) : limits[role];
    return Number.isFinite(limit) ? limit : null;
  }

  /**
   * @param {boolean} canAutoApply true when the requester already holds LOYALTY_ADJUST_APPROVE
   *   (owner/manager) — their own adjustment applies immediately instead of queuing, unless it
   *   is above their role's configured point limit, which forces it into the approval queue.
   */
  async createPatientAdjustment(patientId, payload, actor, req, canAutoApply) {
    const { points, reasonCategory, note } = payload;
    const limit = await this.#manualAdjustmentLimitFor(actor?.role);
    const withinOwnAuthority = limit === null || points <= limit;
    const applyNow = canAutoApply && withinOwnAuthority;
    // The patient-360 panel sends the ledger vocabulary (entryType); the admin queue sends
    // `direction`. Accept either and normalise to direction, which the ledger service wants.
    const direction = payload.direction || (payload.entryType === 'MANUAL_DEBIT' ? 'DEBIT' : 'CREDIT');
    const branchId = payload.branchId || (await this.#resolvePatientBranchId(patientId));
    if (!branchId) {
      throw ApiError.badRequest('branchId is required — patient has no primary branch on file.');
    }

    if (applyNow) {
      const entries = this.#asEntryList(
        await this.ledgerService.manualAdjustment({
          branchId,
          patientId,
          points,
          direction,
          reasonCategory,
          note,
          approvedBy: actor.userId,
          createdBy: actor.userId,
          actorReq: req,
        })
      );
      const request = await LoyaltyAdjustmentRequest.create({
        branchId,
        patientId,
        direction,
        points,
        reasonCategory,
        note,
        status: LOYALTY_ADJUSTMENT_STATUS.APPLIED,
        requestedBy: actor.userId,
        decidedBy: actor.userId,
        decidedAt: new Date(),
        ledgerEntryIds: entries.map((e) => e.id),
      });
      return request.toSafeObject({ ledgerEntries: entries });
    }

    const request = await LoyaltyAdjustmentRequest.create({
      branchId,
      patientId,
      direction,
      points,
      reasonCategory,
      note,
      status: LOYALTY_ADJUSTMENT_STATUS.PENDING_APPROVAL,
      requestedBy: actor.userId,
    });

    eventBus.emitDomain(LOYALTY_EVENTS.ADJUSTMENT_PENDING_APPROVAL, {
      adjustmentRequestId: request._id.toString(),
      patientId: patientId.toString(),
      // Lets the notification subscriber fan out to approvers of THIS branch only rather than
      // every approver tenant-wide.
      branchId: branchId.toString(),
      points,
      direction,
    });

    return request.toSafeObject();
  }

  /**
   * SEC-030 — LoyaltyAdjustmentRequest carries a required `branchId` (the branch that raised the
   * adjustment), so the approval queue is genuinely a per-branch worklist and is pinned to it.
   * This is the one loyalty read that IS branch data: the balances and ledger below deliberately
   * are not (see LoyaltyController).
   */
  async listAdjustmentQueue({ status = LOYALTY_ADJUSTMENT_STATUS.PENDING_APPROVAL, patientId, branchId } = {}) {
    const query = {};
    if (status) query.status = status;
    if (patientId) query.patientId = patientId;
    if (branchId) query.branchId = branchId;
    // Populated so the approver sees names, not raw ObjectIds.
    const requests = await LoyaltyAdjustmentRequest.find(query)
      .populate('patientId', 'firstName lastName fullName patientCode')
      .populate('requestedBy', 'firstName lastName fullName')
      .sort({ createdAt: -1 });

    return requests.map((r) => {
      const patient = r.patientId && typeof r.patientId === 'object' ? r.patientId : null;
      const requester = r.requestedBy && typeof r.requestedBy === 'object' ? r.requestedBy : null;
      const fullName = (doc) =>
        doc?.fullName || [doc?.firstName, doc?.lastName].filter(Boolean).join(' ') || null;

      return {
        ...r.toSafeObject({
          patient: patient ? { id: patient._id.toString(), fullName: fullName(patient), patientCode: patient.patientCode } : null,
          createdBy: requester ? { id: requester._id.toString(), fullName: fullName(requester) } : null,
        }),
        patientId: patient ? patient._id.toString() : r.patientId?.toString?.() || null,
        requestedBy: requester ? requester._id.toString() : r.requestedBy?.toString?.() || null,
      };
    });
  }

  /** SEC-030 — 404 (never 403) for another branch's pending adjustment. */
  #assertRequestInBranch(request, scopedBranchId) {
    if (scopedBranchId && String(request.branchId || '') !== String(scopedBranchId)) {
      throw ApiError.notFound('Adjustment request not found');
    }
  }

  async approveAdjustment(id, payload, actorId, req, scopedBranchId = null) {
    const request = await LoyaltyAdjustmentRequest.findById(id);
    if (!request) throw ApiError.notFound('Adjustment request not found');
    this.#assertRequestInBranch(request, scopedBranchId);
    if (request.status !== LOYALTY_ADJUSTMENT_STATUS.PENDING_APPROVAL) {
      throw ApiError.badRequest('Only pending adjustment requests can be approved');
    }

    const entries = this.#asEntryList(
      await this.ledgerService.manualAdjustment({
        branchId: request.branchId,
        patientId: request.patientId,
        points: request.points,
        direction: request.direction,
        reasonCategory: request.reasonCategory,
        note: request.note,
        approvedBy: actorId,
        createdBy: request.requestedBy,
        actorReq: req,
      })
    );

    request.status = LOYALTY_ADJUSTMENT_STATUS.APPROVED;
    request.decidedBy = actorId;
    request.decidedAt = new Date();
    request.decisionNote = payload?.decisionNote || payload?.note || null;
    request.ledgerEntryIds = entries.map((e) => e.id);
    await request.save();

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_ADJUSTMENT_APPROVED, {
      actorId,
      req,
      resourceType: 'LoyaltyAdjustmentRequest',
      resourceId: request._id,
      metadata: { patientId: request.patientId.toString(), points: request.points, direction: request.direction },
    });

    return request.toSafeObject({ ledgerEntries: entries });
  }

  async rejectAdjustment(id, payload, actorId, req, scopedBranchId = null) {
    const request = await LoyaltyAdjustmentRequest.findById(id);
    if (!request) throw ApiError.notFound('Adjustment request not found');
    this.#assertRequestInBranch(request, scopedBranchId);
    if (request.status !== LOYALTY_ADJUSTMENT_STATUS.PENDING_APPROVAL) {
      throw ApiError.badRequest('Only pending adjustment requests can be rejected');
    }

    request.status = LOYALTY_ADJUSTMENT_STATUS.REJECTED;
    request.decidedBy = actorId;
    request.decidedAt = new Date();
    request.decisionNote = payload?.decisionNote || payload?.note || null;
    await request.save();

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_ADJUSTMENT_REJECTED, {
      actorId,
      req,
      resourceType: 'LoyaltyAdjustmentRequest',
      resourceId: request._id,
      metadata: { patientId: request.patientId.toString(), reason: payload?.decisionNote },
    });

    return request.toSafeObject();
  }

  // ---- Patient ledger (paged) ----------------------------------------------

  /**
   * Page-based wrapper around the ledger for the patient-360 panel, which renders a Pagination
   * control and therefore needs a total count. LoyaltyLedgerService.listLedger stays cursor-based
   * (`before`) for the patient app's infinite scroll — this does not change it.
   */
  async listPatientLedger(patientId, { page = 1, limit = 10 } = {}) {
    const [total, entries] = await Promise.all([
      LoyaltyLedgerEntry.countDocuments({ patientId }),
      LoyaltyLedgerEntry.find({ patientId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return {
      items: entries.map((e) => ({
        id: e._id.toString(),
        entryType: e.entryType,
        points: e.points,
        ruleCode: e.ruleCode,
        sourceRefType: e.sourceRefType,
        sourceRefId: e.sourceRefId?.toString?.() || null,
        note: e.note,
        createdAt: e.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  // ---- Reports / dashboard summary (LOY-014) -------------------------------

  async getDashboardSummary({ branchId, from, to } = {}) {
    const match = {};
    // Must be cast: branchId arrives as a query-string string and an aggregate $match does no
    // implicit casting, so a raw string would silently match nothing.
    if (branchId) match.branchId = new mongoose.Types.ObjectId(String(branchId));
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    const rows = await LoyaltyLedgerEntry.aggregate([
      { $match: match },
      { $group: { _id: '$entryType', total: { $sum: '$points' }, count: { $sum: 1 } } },
    ]);
    const byType = Object.fromEntries(rows.map((r) => [r._id, { points: r.total, count: r.count }]));
    const get = (t) => byType[t]?.points || 0;

    const totalIssued = get(LOYALTY_ENTRY_TYPE.CREDIT) + get(LOYALTY_ENTRY_TYPE.MANUAL_CREDIT);
    const totalRedeemed = get(LOYALTY_ENTRY_TYPE.DEBIT_REDEEM);
    const totalExpired = get(LOYALTY_ENTRY_TYPE.DEBIT_EXPIRY);
    const totalClawedBack = get(LOYALTY_ENTRY_TYPE.DEBIT_CLAWBACK);
    const totalManualDebit = get(LOYALTY_ENTRY_TYPE.MANUAL_DEBIT);

    const outstandingLiabilityPoints = Math.max(
      0,
      totalIssued - totalRedeemed - totalExpired - totalClawedBack - totalManualDebit
    );

    const settings = await this.getSettings();
    const outstandingLiabilityInr = settings?.redemptionPointsPerRupee
      ? Math.round((outstandingLiabilityPoints / settings.redemptionPointsPerRupee) * 100) / 100
      : null;

    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);

    const [pendingAdjustments, activeCampaignsCount, expiringLots] = await Promise.all([
      LoyaltyAdjustmentRequest.countDocuments({ status: LOYALTY_ADJUSTMENT_STATUS.PENDING_APPROVAL }),
      LoyaltyCampaign.countDocuments({
        status: LOYALTY_CAMPAIGN_STATUS.ACTIVE,
        startDate: { $lte: now },
        endDate: { $gte: now },
      }),
      this.ledgerService.findLotsExpiringWithin(30),
    ]);

    // findLotsExpiringWithin returns every still-open lot due on or before the cutoff, including
    // already-overdue ones the expiry job has not swept yet — count only the forward window.
    const pointsExpiringIn30Days = expiringLots
      .filter((lot) => lot.earnLotExpiryDate >= now && lot.earnLotExpiryDate <= in30Days)
      .reduce((sum, lot) => sum + lot.remaining, 0);

    return {
      totalIssued,
      totalRedeemed,
      totalExpired,
      totalClawedBack,
      outstandingLiabilityPoints,
      outstandingLiabilityInr,
      pointsExpiringIn30Days,
      activeCampaignsCount,
      pendingAdjustments,
      byEntryType: byType,
    };
  }
}

export default LoyaltyAdminService;
