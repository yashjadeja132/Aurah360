import ApiError from '../libs/ApiError.js';
import RecallEntry from '../models/RecallEntry.model.js';
import Offer from '../models/Offer.model.js';
import PatientFeedback from '../models/PatientFeedback.model.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';

/** Missed-follow-up recall worklist, offer board and feedback/NPS escalation (CRM-001). */
class CrmExtensionsService {
  constructor() {
    this.auditService = new AuditService();
  }

  // --- Recall worklist -------------------------------------------------------------
  async createRecallEntry(payload, actorId) {
    const entry = await RecallEntry.create({ ...payload, createdBy: actorId });
    return entry.toSafeObject();
  }

  async listRecallWorklist(query = {}) {
    const filter = { status: 'PENDING', dueDate: { $lte: query.asOf ? new Date(query.asOf) : new Date() } };
    if (query.branchId) filter.branchId = query.branchId;
    if (query.assignedTo) filter.assignedTo = query.assignedTo;
    const rows = await RecallEntry.find(filter).sort({ priority: -1, dueDate: 1 }).exec();
    return rows.map((r) => r.toSafeObject());
  }

  async recordRecallOutcome(id, { status, outcomeNotes, resultingAppointmentId }, actorId, req = null) {
    const entry = await RecallEntry.findById(id);
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
  async createOffer(payload, actorId, req = null) {
    const offer = await Offer.create({ ...payload, createdBy: actorId });
    await this.auditService.record(AUDIT_ACTIONS.OFFER_CREATED, { actorId, metadata: { offerId: offer._id.toString() }, req });
    return offer.toSafeObject();
  }

  async updateOffer(id, payload, actorId, req = null) {
    const offer = await Offer.findByIdAndUpdate(id, payload, { new: true });
    if (!offer) throw ApiError.notFound('Offer not found');
    await this.auditService.record(AUDIT_ACTIONS.OFFER_UPDATED, { actorId, metadata: { offerId: id }, req });
    return offer.toSafeObject();
  }

  async listOffers(query = {}) {
    const filter = {};
    if (query.activeOnly === 'true') {
      filter.isActive = true;
      filter.validFrom = { $lte: new Date() };
      filter.validTo = { $gte: new Date() };
    }
    if (query.branchId) filter.$or = [{ branchIds: query.branchId }, { branchIds: { $size: 0 } }];
    const rows = await Offer.find(filter).sort({ createdAt: -1 }).exec();
    return rows.map((r) => r.toSafeObject());
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

  async resolveFeedback(id, { resolutionNotes }, actorId) {
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
