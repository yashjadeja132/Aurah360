import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import QueueService from '../services/QueueService.js';
import ApiError from '../libs/ApiError.js';
import { scopedListQuery } from '../helpers/scope.helper.js';

/**
 * SEC-030 — all three queue BROWSE views are row-scoped: branch comes from the caller's token
 * for every non-OWNER/ADMIN role, and a DOCTOR additionally only ever sees their own column of
 * the board (including in `summary`, whose totals would otherwise reveal colleagues' volumes).
 * `getById` on a single queue entry is left broad — the queue is a shared, live front-desk
 * artefact and staff legitimately act on each other's entries (call, skip, transfer).
 *
 * PRD §6.5 — the two board AUDIENCES are separated here, at the only place that knows which one
 * asked: `?view=PUBLIC` is the lobby screen and gets a masked payload, anything else is the
 * staff board and gets the full record. The choice is made server-side and the public payload is
 * built by a whitelist in QueueService, so a UI that forgets to mask cannot leak identity.
 */
const QUEUE_VIEW_PUBLIC = 'PUBLIC';
const isPublicDisplay = (query) => query?.view === QUEUE_VIEW_PUBLIC;

class QueueController {
  constructor() {
    this.queueService = new QueueService();
  }

  summary = asyncHandler(async (req, res) => {
    const scoped = await scopedListQuery(req, { branch: true, doctor: true });
    if (!scoped.branchId) throw ApiError.badRequest('branchId is required');
    const data = await this.queueService.summary(
      scoped.branchId,
      scoped.date ? new Date(scoped.date) : new Date(),
      { doctorId: scoped.doctorId || null }
    );
    return ApiResponse.success(res, { data });
  });

  branchQueue = asyncHandler(async (req, res) => {
    const scoped = await scopedListQuery(req, { branch: true, doctor: true });
    if (!scoped.branchId) throw ApiError.badRequest('branchId is required');
    const items = await this.queueService.listBranchQueue(
      scoped.branchId,
      scoped.date ? new Date(scoped.date) : new Date(),
      { doctorId: scoped.doctorId || null, publicDisplay: isPublicDisplay(scoped) }
    );
    return ApiResponse.success(res, { data: items });
  });

  doctorQueue = asyncHandler(async (req, res) => {
    const scoped = await scopedListQuery(req, { branch: true, doctor: true });
    if (!scoped.doctorId) throw ApiError.badRequest('doctorId is required');
    const items = await this.queueService.listDoctorQueue(
      scoped.doctorId,
      scoped.date ? new Date(scoped.date) : new Date(),
      { publicDisplay: isPublicDisplay(scoped) }
    );
    return ApiResponse.success(res, { data: items });
  });

  getById = asyncHandler(async (req, res) => {
    const queueEntry = await this.queueService.getById(req.params.id);
    return ApiResponse.success(res, { data: { queueEntry } });
  });

  callNext = asyncHandler(async (req, res) => {
    const queueEntry = await this.queueService.callNext(
      req.body.doctorId,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Next patient called', data: { queueEntry } });
  });

  call = asyncHandler(async (req, res) => {
    const queueEntry = await this.queueService.callPatient(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Patient called', data: { queueEntry } });
  });

  recall = asyncHandler(async (req, res) => {
    const queueEntry = await this.queueService.recall(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Patient recalled', data: { queueEntry } });
  });

  skip = asyncHandler(async (req, res) => {
    const queueEntry = await this.queueService.skip(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Patient skipped', data: { queueEntry } });
  });

  startConsultation = asyncHandler(async (req, res) => {
    const queueEntry = await this.queueService.startConsultation(
      req.params.id,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Consultation started', data: { queueEntry } });
  });

  complete = asyncHandler(async (req, res) => {
    const queueEntry = await this.queueService.complete(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Queue entry completed', data: { queueEntry } });
  });

  transfer = asyncHandler(async (req, res) => {
    const queueEntry = await this.queueService.transfer(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Queue transferred', data: { queueEntry } });
  });

  reorder = asyncHandler(async (req, res) => {
    const queueEntry = await this.queueService.reorder(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Queue reordered', data: { queueEntry } });
  });
}

export default QueueController;
