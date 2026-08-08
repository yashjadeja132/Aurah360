import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import TreatmentSessionService from '../services/TreatmentSessionService.js';
import { scopedListQuery } from '../helpers/scope.helper.js';

/**
 * SEC-030 — `list` and `dashboard` are cross-patient BROWSE views and are row-scoped to the
 * caller's branch and, for a DOCTOR, to their own server-resolved doctorId. Session reads by
 * session/plan id (`getById`, `progress`, `preflight`, `print`) stay broad and audited: a
 * technician or covering doctor running the session must be able to open it.
 */
class TreatmentSessionController {
  constructor() {
    this.service = new TreatmentSessionService();
  }

  dashboard = asyncHandler(async (req, res) => {
    const data = await this.service.dashboard(
      await scopedListQuery(req, { branch: true, doctor: true })
    );
    return ApiResponse.success(res, { data });
  });

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(
      await scopedListQuery(req, { branch: true, doctor: true })
    );
    return ApiResponse.success(res, {
      message: 'Sessions retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  progress = asyncHandler(async (req, res) => {
    const progress = await this.service.getProgress(req.params.planId);
    return ApiResponse.success(res, { data: { progress } });
  });

  create = asyncHandler(async (req, res) => {
    const session = await this.service.create(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Session created', data: { session } });
  });

  getById = asyncHandler(async (req, res) => {
    const session = await this.service.getById(req.params.id);
    return ApiResponse.success(res, { data: { session } });
  });

  update = asyncHandler(async (req, res) => {
    const session = await this.service.update(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Session updated', data: { session } });
  });

  checkIn = asyncHandler(async (req, res) => {
    const session = await this.service.checkIn(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Checked in', data: { session } });
  });

  preflight = asyncHandler(async (req, res) => {
    const preflight = await this.service.getPreflight(req.params.id, req);
    return ApiResponse.success(res, { message: 'Pre-flight evaluated', data: { preflight } });
  });

  start = asyncHandler(async (req, res) => {
    const session = await this.service.start(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Session started', data: { session } });
  });

  complete = asyncHandler(async (req, res) => {
    const session = await this.service.complete(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Session completed', data: { session } });
  });

  cancel = asyncHandler(async (req, res) => {
    const session = await this.service.cancel(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Session cancelled', data: { session } });
  });

  reverseCompletion = asyncHandler(async (req, res) => {
    const session = await this.service.reverseSessionCompletion(
      req.params.id,
      { reason: req.body?.reason },
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Session completion reversed', data: { session } });
  });

  skip = asyncHandler(async (req, res) => {
    const session = await this.service.skip(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Session skipped', data: { session } });
  });

  reschedule = asyncHandler(async (req, res) => {
    const session = await this.service.reschedule(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Session rescheduled', data: { session } });
  });

  uploadPhoto = asyncHandler(async (req, res) => {
    const session = await this.service.uploadPhoto(
      req.params.id,
      {
        file: req.file,
        photoType: req.body.photoType,
        title: req.body.title,
        // IMG-003 — drives the restricted-body-area policy in ClinicalPhotoPolicyService. A
        // client-supplied consentVerified is never read here; consent comes from the grant log.
        bodyRegion: req.body.bodyRegion,
      },
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Photo uploaded', data: { session } });
  });

  print = asyncHandler(async (req, res) => {
    const data = await this.service.getPrintData(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Print data ready', data });
  });
}

export default TreatmentSessionController;
