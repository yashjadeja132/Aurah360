import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import CrmExtensionsService from '../services/CrmExtensionsService.js';
import { scopedListQuery, resolveRecordScope } from '../helpers/scope.helper.js';

/**
 * SEC-030 — the two branch-dimensioned CRM extensions are scoped; the third is not, and
 * deliberately so.
 *
 *  * RECALL WORKLIST (`RecallEntry.branchId`) — a patient call list with names and phone
 *    numbers. Pinned to the caller's branch. Because `branchId` is NULLABLE here, entries with
 *    no branch stay visible to scoped callers: null means "not tied to a site", not "belongs to
 *    someone else", and hiding them would silently strip existing rows from every worklist —
 *    an outage, not a fix.
 *
 *  * OFFERS (`Offer.branchIds`, an array where EMPTY means "all branches") — the repository
 *    filter already models exactly that (`$or: [{branchIds: <id>}, {branchIds: {$size: 0}}]`),
 *    so a branch-scoped user sees their own branch's offers plus the org-wide ones, and never
 *    another branch's private campaign pricing.
 *
 *  * FEEDBACK / NPS — `PatientFeedback` has NO branch dimension of any kind (it keys on
 *    patientId / doctorId / appointmentId). It is left org-wide rather than have this change
 *    invent a branch column for it; scoping it properly means denormalising a branch onto the
 *    model, which is a schema decision, not a controller one.
 */
class CrmExtensionsController {
  constructor() {
    this.service = new CrmExtensionsService();
  }

  createRecallEntry = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const entry = await this.service.createRecallEntry(req.body, req.auth.userId, { branchId });
    return ApiResponse.created(res, { message: 'Recall entry created', data: { entry } });
  });

  listRecallWorklist = asyncHandler(async (req, res) => {
    const entries = await this.service.listRecallWorklist(
      await scopedListQuery(req, { branch: true })
    );
    return ApiResponse.success(res, { message: 'Recall worklist retrieved', data: { entries } });
  });

  recordRecallOutcome = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const entry = await this.service.recordRecallOutcome(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      scope
    );
    return ApiResponse.success(res, { message: 'Recall outcome recorded', data: { entry } });
  });

  createOffer = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const offer = await this.service.createOffer(req.body, req.auth.userId, req, { branchId });
    return ApiResponse.created(res, { message: 'Offer created', data: { offer } });
  });

  updateOffer = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const offer = await this.service.updateOffer(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      scope
    );
    return ApiResponse.success(res, { message: 'Offer updated', data: { offer } });
  });

  listOffers = asyncHandler(async (req, res) => {
    const offers = await this.service.listOffers(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { message: 'Offers retrieved', data: { offers } });
  });

  submitFeedback = asyncHandler(async (req, res) => {
    const feedback = await this.service.submitFeedback(req.body, req.auth?.userId || null, req);
    return ApiResponse.created(res, { message: 'Feedback submitted', data: { feedback } });
  });

  listFeedback = asyncHandler(async (req, res) => {
    const feedback = await this.service.listFeedback(req.query);
    return ApiResponse.success(res, { message: 'Feedback retrieved', data: { feedback } });
  });

  escalateFeedback = asyncHandler(async (req, res) => {
    const feedback = await this.service.escalateFeedback(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Feedback escalated', data: { feedback } });
  });

  resolveFeedback = asyncHandler(async (req, res) => {
    const feedback = await this.service.resolveFeedback(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Feedback resolved', data: { feedback } });
  });
}

export default CrmExtensionsController;
