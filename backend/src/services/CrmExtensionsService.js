import ApiError from '../libs/ApiError.js';
import RecallEntry from '../models/RecallEntry.model.js';
import Offer from '../models/Offer.model.js';
import PatientFeedback from '../models/PatientFeedback.model.js';
import Patient from '../models/Patient.model.js';
import LoyaltyTier, { PatientTierState } from '../models/LoyaltyTier.model.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';

/** Missed-follow-up recall worklist, offer board and feedback/NPS escalation (CRM-001). */
class CrmExtensionsService {
  constructor() {
    this.auditService = new AuditService();
  }

  // --- Recall worklist -------------------------------------------------------------
  async createRecallEntry(payload, actorId, { branchId = null } = {}) {
    // A branch-scoped user files recalls against their own branch. 403 (not 404) — the caller
    // named a branch id, not a record id.
    if (branchId && payload.branchId && String(payload.branchId) !== String(branchId)) {
      throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }
    const entry = await RecallEntry.create({
      ...payload,
      ...(branchId ? { branchId } : {}),
      createdBy: actorId,
    });
    return entry.toSafeObject();
  }

  async listRecallWorklist(query = {}) {
    const filter = { status: 'PENDING', dueDate: { $lte: query.asOf ? new Date(query.asOf) : new Date() } };
    // `branchId` is nullable on RecallEntry: null means "not tied to a site", so an unassigned
    // entry stays on every worklist rather than vanishing from all of them.
    if (query.branchId) filter.branchId = { $in: [query.branchId, null] };
    if (query.assignedTo) filter.assignedTo = query.assignedTo;
    const rows = await RecallEntry.find(filter).sort({ priority: -1, dueDate: 1 }).exec();
    return rows.map((r) => r.toSafeObject());
  }

  async recordRecallOutcome(
    id,
    { status, outcomeNotes, resultingAppointmentId },
    actorId,
    req = null,
    { branchId = null } = {}
  ) {
    // Branch is folded into the lookup — an out-of-branch entry reads as 404, never 403.
    const entry = await RecallEntry.findOne(
      branchId ? { _id: id, branchId: { $in: [branchId, null] } } : { _id: id }
    );
    if (!entry) throw ApiError.notFound('Recall entry not found');
    entry.status = status;
    entry.outcomeNotes = outcomeNotes || null;
    entry.resultingAppointmentId = resultingAppointmentId || null;
    entry.callAttempts += 1;
    entry.lastAttemptAt = new Date();
    await entry.save();

    await this.auditService.record(AUDIT_ACTIONS.RECALL_OUTCOME_RECORDED, {
      actorId,
      metadata: { recallEntryId: id, status },
      req,
    });
    return entry.toSafeObject();
  }

  // --- Offer board -------------------------------------------------------------
  /**
   * SEC-030 — `branchIds: []` means "every branch", so a branch-scoped user must not be able to
   * publish one: that is an org-wide broadcast from a single site. Their offers are pinned to
   * their own branch, and any other branch id in the array is refused.
   */
  #assertOfferBranches(branchIds, branchId) {
    if (!branchId) return branchIds;
    const requested = branchIds || [];
    if (requested.some((id) => String(id) !== String(branchId))) {
      throw ApiError.forbidden('branchIds is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }
    return [branchId];
  }

  async createOffer(payload, actorId, req = null, { branchId = null } = {}) {
    const offer = await Offer.create({
      ...payload,
      branchIds: this.#assertOfferBranches(payload.branchIds, branchId) || payload.branchIds,
      createdBy: actorId,
    });
    await this.auditService.record(AUDIT_ACTIONS.OFFER_CREATED, { actorId, metadata: { offerId: offer._id.toString() }, req });
    return offer.toSafeObject();
  }

  async updateOffer(id, payload, actorId, req = null, { branchId = null } = {}) {
    // Scoped callers may only touch an offer that is theirs alone. An org-wide offer
    // (branchIds: []) is NOT editable from a single branch — editing it would change what every
    // other site shows. Out of scope reads as 404, never 403.
    const filter = branchId ? { _id: id, branchIds: [branchId] } : { _id: id };
    const updates = branchId
      ? { ...payload, ...(payload.branchIds ? { branchIds: this.#assertOfferBranches(payload.branchIds, branchId) } : {}) }
      : payload;
    const offer = await Offer.findOneAndUpdate(filter, updates, { new: true });
    if (!offer) throw ApiError.notFound('Offer not found');
    await this.auditService.record(AUDIT_ACTIONS.OFFER_UPDATED, { actorId, metadata: { offerId: id }, req });
    return offer.toSafeObject();
  }

  /**
   * When listing offers FOR a specific patient (query.patientId), a non-consenting patient must
   * not see offers that require marketing consent, and tier-targeted offers must not be shown to
   * a patient outside those tiers. Both checks are skipped when no patientId is supplied (e.g. the
   * admin offer-board list), same as LoyaltyEarningEngineService.isEligible's consent check only
   * applying when there is a patient to check.
   */
  async listOffers(query = {}) {
    const filter = {};
    if (query.activeOnly === 'true') {
      filter.isActive = true;
      filter.validFrom = { $lte: new Date() };
      filter.validTo = { $gte: new Date() };
    }
    // `branchIds: []` = every branch, so a scoped caller sees their branch's offers PLUS the
    // org-wide ones — and nothing that belongs only to another site.
    if (query.branchId) filter.$or = [{ branchIds: query.branchId }, { branchIds: { $size: 0 } }];

    const rows = await Offer.find(filter).sort({ createdAt: -1 }).exec();
    let offers = rows.map((r) => r.toSafeObject());

    if (query.patientId) {
      const [patient, tierState] = await Promise.all([
        Patient.findById(query.patientId).select('consent').lean(),
        PatientTierState.findOne({ patientId: query.patientId }).select('currentTierId').lean(),
      ]);
      const hasMarketingConsent = Boolean(patient?.consent?.marketingConsent);
      let tierName = null;
      if (tierState?.currentTierId) {
        const tier = await LoyaltyTier.findById(tierState.currentTierId).select('name').lean();
        tierName = tier?.name || null;
      }

      offers = offers.filter((offer) => {
        if (offer.requiresMarketingConsent && !hasMarketingConsent) return false;
        if (offer.targetTiers?.length && !(tierName && offer.targetTiers.includes(tierName))) return false;
        return true;
      });
    }

    return offers;
  }

  // --- Feedback / NPS / complaint escalation -------------------------------------------------------------
  async submitFeedback(payload, actorId = null, req = null) {
    const isComplaint = payload.isComplaint || (payload.clinicRating && payload.clinicRating <= 2);
    const feedback = await PatientFeedback.create({ ...payload, isComplaint });

    await this.auditService.record(AUDIT_ACTIONS.NPS_FEEDBACK_RECORDED, {
      actorId,
      metadata: { patientId: payload.patientId, npsScore: payload.npsScore, isComplaint },
      req,
    });

    if (isComplaint) {
      await this.auditService.record(AUDIT_ACTIONS.COMPLAINT_ESCALATED, {
        actorId,
        metadata: { feedbackId: feedback._id.toString(), patientId: payload.patientId },
        req,
      });
    }

    return feedback.toSafeObject();
  }

  async listFeedback(query = {}) {
    const filter = { deletedAt: null };
    if (query.isComplaint === 'true') filter.isComplaint = true;
    if (query.status) filter.status = query.status;
    const rows = await PatientFeedback.find(filter).sort({ createdAt: -1 }).limit(200).exec();
    return rows.map((r) => r.toSafeObject());
  }

  async escalateFeedback(id, { escalatedTo }, actorId, req = null) {
    const feedback = await PatientFeedback.findById(id);
    if (!feedback) throw ApiError.notFound('Feedback not found');
    feedback.isComplaint = true;
    feedback.escalatedTo = escalatedTo;
    feedback.escalatedAt = new Date();
    await feedback.save();

    await this.auditService.record(AUDIT_ACTIONS.COMPLAINT_ESCALATED, {
      actorId,
      metadata: { feedbackId: id, escalatedTo },
      req,
    });
    return feedback.toSafeObject();
  }

  async resolveFeedback(id, { resolutionNotes }, _actorId) {
    const feedback = await PatientFeedback.findById(id);
    if (!feedback) throw ApiError.notFound('Feedback not found');
    feedback.status = 'REVIEWED';
    feedback.resolutionNotes = resolutionNotes || null;
    feedback.resolvedAt = new Date();
    await feedback.save();
    return feedback.toSafeObject();
  }
}

export default CrmExtensionsService;
