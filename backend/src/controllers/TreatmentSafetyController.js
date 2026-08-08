import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import TreatmentSafetyService from '../services/TreatmentSafetyService.js';
import { scopedListQuery, resolveRecordScope } from '../helpers/scope.helper.js';

/**
 * SEC-030 — adverse events are branch-scoped.
 *
 * `AdverseEvent.branchId` is a REQUIRED field, so every row has a branch and the whole
 * collection can be pinned without hiding anything. Before this, `listAdverseEvents` passed
 * `req.query` straight through: a TECHNICIAN or NURSE at one branch read every clinical
 * safety incident in the organisation — patient id, severity, free-text description of the
 * injury — and could aim `?branchId=<other>` at another site deliberately. Adverse events are
 * the most sensitive clinical-safety record in the system; a cross-branch read here is a
 * privacy breach, not an inconvenience.
 *
 * Writes are scoped to the same rule: an out-of-branch id answers 404, never 403, because a
 * 403 would confirm to an enumerating caller that the event exists.
 *
 * PATCH TESTS are deliberately NOT scoped: `PatchTest` carries no branch dimension at all
 * (it is keyed on patientId), and the only read is `/patch-tests/patients/:patientId`, which
 * is already narrowed to one patient the caller named. Inventing a branch column for it is
 * out of scope for this change.
 */
class TreatmentSafetyController {
  constructor() {
    this.service = new TreatmentSafetyService();
  }

  recordPatchTest = asyncHandler(async (req, res) => {
    const test = await this.service.recordPatchTest(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Patch test recorded', data: { test } });
  });

  reviewPatchTest = asyncHandler(async (req, res) => {
    const test = await this.service.reviewPatchTest(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Patch test reviewed', data: { test } });
  });

  listPatchTestsForPatient = asyncHandler(async (req, res) => {
    const tests = await this.service.listPatchTestsForPatient(req.params.patientId);
    return ApiResponse.success(res, { message: 'Patch tests retrieved', data: { tests } });
  });

  reportAdverseEvent = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const event = await this.service.reportAdverseEvent(
      // A branch-scoped reporter files against their OWN branch — the body cannot place an
      // incident at another site. 403 (not 404) is right here: the caller supplied a branch id,
      // not a record id, and branch ids are already public to them via GET /branches.
      branchId ? { ...req.body, branchId } : req.body,
      req.auth.userId,
      req,
      { branchId }
    );
    return ApiResponse.created(res, { message: 'Adverse event reported', data: { event } });
  });

  listAdverseEvents = asyncHandler(async (req, res) => {
    const events = await this.service.listAdverseEvents(
      await scopedListQuery(req, { branch: true })
    );
    return ApiResponse.success(res, { message: 'Adverse events retrieved', data: { events } });
  });

  updateAdverseEvent = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const event = await this.service.updateAdverseEvent(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      scope
    );
    return ApiResponse.success(res, { message: 'Adverse event updated', data: { event } });
  });

  closeAdverseEvent = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const event = await this.service.closeAdverseEvent(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      scope
    );
    return ApiResponse.success(res, { message: 'Adverse event closed', data: { event } });
  });
}

export default TreatmentSafetyController;
