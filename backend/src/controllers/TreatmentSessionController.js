import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import TreatmentSessionService from '../services/TreatmentSessionService.js';

class TreatmentSessionController {
  constructor() {
    this.service = new TreatmentSessionService();
  }

  dashboard = asyncHandler(async (req, res) => {
    const data = await this.service.dashboard(req.query);
    return ApiResponse.success(res, { data });
  });

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(req.query);
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
