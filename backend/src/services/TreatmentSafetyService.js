import ApiError from '../libs/ApiError.js';
import PatchTest from '../models/PatchTest.model.js';
import AdverseEvent from '../models/AdverseEvent.model.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { ADVERSE_EVENT_STATUS } from '../enums/treatmentSession.js';
import eventBus from '../events/eventBus.js';

/** Patch tests and adverse events — treatment safety records independent of billing state. */
class TreatmentSafetyService {
  constructor() {
    this.auditService = new AuditService();
  }

  // --- Patch tests -------------------------------------------------------------
  async recordPatchTest(payload, actorId, req = null) {
    const test = await PatchTest.create({ ...payload, performedBy: actorId });
    await this.auditService.record(AUDIT_ACTIONS.PATCH_TEST_RECORDED, {
      actorId,
      metadata: { patientId: payload.patientId, patchTestId: test._id.toString(), result: test.result },
      req,
    });
    return test.toSafeObject();
  }

  async reviewPatchTest(id, { result, reactionNotes, validUntil }, actorId, req = null) {
    const test = await PatchTest.findById(id);
    if (!test) throw ApiError.notFound('Patch test not found');
    test.result = result;
    test.reactionNotes = reactionNotes || null;
    test.validUntil = validUntil || null;
    test.reviewedBy = actorId;
    test.reviewedAt = new Date();
    await test.save();

    await this.auditService.record(AUDIT_ACTIONS.PATCH_TEST_RECORDED, {
      actorId,
      metadata: { patchTestId: id, result },
      req,
    });
    return test.toSafeObject();
  }

  async listPatchTestsForPatient(patientId) {
    const rows = await PatchTest.find({ patientId }).sort({ testedAt: -1 }).exec();
    return rows.map((r) => r.toSafeObject());
  }

  // --- Adverse events -------------------------------------------------------------
  /**
   * SEC-030 — `scope.branchId` is the caller's pinned branch (null for OWNER/ADMIN). The
   * controller has already forced it onto the payload; this assertion is the belt-and-braces
   * check so a future caller cannot slip an out-of-branch write past the service directly.
   */
  async reportAdverseEvent(payload, actorId, req = null, { branchId = null } = {}) {
    if (branchId && String(payload.branchId) !== String(branchId)) {
      throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }
    const event = await AdverseEvent.create({
      ...payload,
      reportedBy: actorId,
      responsibleClinicianId: payload.responsibleClinicianId || actorId,
      status: payload.severity === 'SEVERE' || payload.severity === 'LIFE_THREATENING'
        ? ADVERSE_EVENT_STATUS.ESCALATED
        : ADVERSE_EVENT_STATUS.OPEN,
    });

    await this.auditService.record(AUDIT_ACTIONS.ADVERSE_EVENT_REPORTED, {
      actorId,
      metadata: { patientId: payload.patientId, adverseEventId: event._id.toString(), severity: payload.severity },
      req,
    });

    // High-priority clinical task — separate escalation channel, never suppressed by billing state.
    eventBus.emitDomain('AdverseEventReported', {
      adverseEventId: event._id.toString(),
      patientId: payload.patientId,
      branchId: payload.branchId,
      severity: payload.severity,
    });

    return event.toSafeObject();
  }

  async listAdverseEvents(query = {}) {
    const filter = {};
    if (query.patientId) filter.patientId = query.patientId;
    if (query.branchId) filter.branchId = query.branchId;
    if (query.status) filter.status = query.status;
    const rows = await AdverseEvent.find(filter).sort({ createdAt: -1 }).exec();
    return rows.map((r) => r.toSafeObject());
  }

  /**
   * SEC-030 — the branch filter is part of the LOOKUP, not a check after it: an event in
   * another branch is indistinguishable from one that does not exist (404, never 403).
   */
  #scopedFilter(id, branchId) {
    return branchId ? { _id: id, branchId } : { _id: id };
  }

  async updateAdverseEvent(id, payload, actorId, req = null, { branchId = null } = {}) {
    const event = await AdverseEvent.findOne(this.#scopedFilter(id, branchId));
    if (!event) throw ApiError.notFound('Adverse event not found');
    // A scoped caller may not relocate an event into (or out of) another branch.
    if (branchId && payload.branchId && String(payload.branchId) !== String(branchId)) {
      throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }
    Object.assign(event, payload);
    await event.save();

    await this.auditService.record(AUDIT_ACTIONS.ADVERSE_EVENT_UPDATED, {
      actorId,
      metadata: { adverseEventId: id, status: event.status },
      req,
    });
    return event.toSafeObject();
  }

  async closeAdverseEvent(id, { closureNotes }, actorId, req = null, { branchId = null } = {}) {
    const event = await AdverseEvent.findOne(this.#scopedFilter(id, branchId));
    if (!event) throw ApiError.notFound('Adverse event not found');
    event.status = ADVERSE_EVENT_STATUS.CLOSED;
    event.closedBy = actorId;
    event.closedAt = new Date();
    event.closureNotes = closureNotes || null;
    await event.save();

    await this.auditService.record(AUDIT_ACTIONS.ADVERSE_EVENT_CLOSED, {
      actorId,
      metadata: { adverseEventId: id },
      req,
    });
    return event.toSafeObject();
  }
}

export default TreatmentSafetyService;
