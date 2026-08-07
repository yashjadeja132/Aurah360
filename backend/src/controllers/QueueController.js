import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import QueueService from '../services/QueueService.js';

class QueueController {
  constructor() {
    this.queueService = new QueueService();
  }

  summary = asyncHandler(async (req, res) => {
    const data = await this.queueService.summary(
      req.query.branchId,
      req.query.date ? new Date(req.query.date) : new Date()
    );
    return ApiResponse.success(res, { data });
  });

  branchQueue = asyncHandler(async (req, res) => {
    const items = await this.queueService.listBranchQueue(
      req.query.branchId,
      req.query.date ? new Date(req.query.date) : new Date()
    );
    return ApiResponse.success(res, { data: items });
  });

  doctorQueue = asyncHandler(async (req, res) => {
    const items = await this.queueService.listDoctorQueue(
      req.query.doctorId,
      req.query.date ? new Date(req.query.date) : new Date()
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
    const queueEntry = await this.queueService.reorder(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Queue reordered', data: { queueEntry } });
  });
}

export default QueueController;
