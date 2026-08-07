import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import DoctorService from '../services/DoctorService.js';
import DoctorScheduleService from '../services/DoctorScheduleService.js';
import DoctorLeaveService from '../services/DoctorLeaveService.js';
import DoctorAvailabilityService from '../services/DoctorAvailabilityService.js';

class DoctorController {
  constructor() {
    this.doctorService = new DoctorService();
    this.scheduleService = new DoctorScheduleService();
    this.leaveService = new DoctorLeaveService();
    this.availabilityService = new DoctorAvailabilityService();
  }

  list = asyncHandler(async (req, res) => {
    const result = await this.doctorService.list(req.query);
    return ApiResponse.success(res, {
      message: 'Doctors retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  getById = asyncHandler(async (req, res) => {
    const doctor = await this.doctorService.getById(req.params.id);
    return ApiResponse.success(res, { data: { doctor } });
  });

  create = asyncHandler(async (req, res) => {
    const doctor = await this.doctorService.create(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Doctor created', data: { doctor } });
  });

  update = asyncHandler(async (req, res) => {
    const doctor = await this.doctorService.update(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Doctor updated', data: { doctor } });
  });

  activate = asyncHandler(async (req, res) => {
    const doctor = await this.doctorService.activate(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Doctor activated', data: { doctor } });
  });

  deactivate = asyncHandler(async (req, res) => {
    const doctor = await this.doctorService.deactivate(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Doctor deactivated', data: { doctor } });
  });

  softDelete = asyncHandler(async (req, res) => {
    await this.doctorService.softDelete(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Doctor deleted' });
  });

  listSchedules = asyncHandler(async (req, res) => {
    const schedules = await this.scheduleService.list(req.params.id, req.query);
    return ApiResponse.success(res, { data: schedules });
  });

  upsertSchedules = asyncHandler(async (req, res) => {
    const schedules = await this.scheduleService.upsertWeekly(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Schedule updated', data: schedules });
  });

  deleteSchedule = asyncHandler(async (req, res) => {
    await this.scheduleService.remove(req.params.id, req.params.scheduleId, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Schedule row deleted' });
  });

  previewSlots = asyncHandler(async (req, res) => {
    const slots = await this.scheduleService.previewSlots(req.params.id, req.query);
    return ApiResponse.success(res, { data: { slots } });
  });

  availability = asyncHandler(async (req, res) => {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    const result = await this.availabilityService.getDayAvailability(
      req.params.id,
      date,
      req.query.branchId || null
    );
    return ApiResponse.success(res, { data: result });
  });

  listLeaves = asyncHandler(async (req, res) => {
    const leaves = await this.leaveService.list(req.params.id);
    return ApiResponse.success(res, { data: leaves });
  });

  createLeave = asyncHandler(async (req, res) => {
    const leave = await this.leaveService.create(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.created(res, { message: 'Leave added', data: { leave } });
  });

  updateLeave = asyncHandler(async (req, res) => {
    const leave = await this.leaveService.update(
      req.params.id,
      req.params.leaveId,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Leave updated', data: { leave } });
  });

  deleteLeave = asyncHandler(async (req, res) => {
    await this.leaveService.softDelete(
      req.params.id,
      req.params.leaveId,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Leave deleted' });
  });
}

export default DoctorController;
