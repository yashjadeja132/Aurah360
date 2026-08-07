import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import DoctorAvailabilityService from '../services/DoctorAvailabilityService.js';
import BranchHolidayService from '../services/BranchHolidayService.js';
import DoctorBlockedSlotService from '../services/DoctorBlockedSlotService.js';
import DoctorSpecialScheduleService from '../services/DoctorSpecialScheduleService.js';

class SchedulingController {
  constructor() {
    this.availabilityService = new DoctorAvailabilityService();
    this.holidayService = new BranchHolidayService();
    this.blockedService = new DoctorBlockedSlotService();
    this.specialService = new DoctorSpecialScheduleService();
  }

  getAvailableSlots = asyncHandler(async (req, res) => {
    const { doctorId, date, branchId } = req.query;
    const result = await this.availabilityService.getAvailableSlots(
      doctorId,
      new Date(date),
      branchId || null
    );
    return ApiResponse.success(res, { message: 'Available slots', data: result });
  });

  checkAvailability = asyncHandler(async (req, res) => {
    const available = await this.availabilityService.isDoctorAvailable(
      req.body.doctorId,
      new Date(req.body.date),
      req.body.branchId || null
    );
    return ApiResponse.success(res, { data: { available } });
  });

  validateSlot = asyncHandler(async (req, res) => {
    const result = await this.availabilityService.validateSlot(req.body.doctorId, {
      date: new Date(req.body.date),
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      branchId: req.body.branchId || null,
    });
    return ApiResponse.success(res, { data: result });
  });

  weeklyPreview = asyncHandler(async (req, res) => {
    const result = await this.availabilityService.getWeeklyPreview(
      req.query.doctorId,
      new Date(req.query.weekStart),
      req.query.branchId || null
    );
    return ApiResponse.success(res, { data: result });
  });

  listHolidays = asyncHandler(async (req, res) => {
    const holidays = await this.holidayService.list(req.query.branchId);
    return ApiResponse.success(res, { data: holidays });
  });

  createHoliday = asyncHandler(async (req, res) => {
    const holiday = await this.holidayService.create(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Holiday added', data: { holiday } });
  });

  updateHoliday = asyncHandler(async (req, res) => {
    const holiday = await this.holidayService.update(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Holiday updated', data: { holiday } });
  });

  deleteHoliday = asyncHandler(async (req, res) => {
    await this.holidayService.softDelete(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Holiday removed' });
  });

  listBlocked = asyncHandler(async (req, res) => {
    const items = await this.blockedService.list(req.query.doctorId, req.query);
    return ApiResponse.success(res, { data: items });
  });

  createBlocked = asyncHandler(async (req, res) => {
    const blockedSlot = await this.blockedService.create(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Blocked slot added', data: { blockedSlot } });
  });

  updateBlocked = asyncHandler(async (req, res) => {
    const blockedSlot = await this.blockedService.update(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Blocked slot updated', data: { blockedSlot } });
  });

  deleteBlocked = asyncHandler(async (req, res) => {
    await this.blockedService.softDelete(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Blocked slot removed' });
  });

  listSpecial = asyncHandler(async (req, res) => {
    const items = await this.specialService.list(req.query.doctorId, req.query);
    return ApiResponse.success(res, { data: items });
  });

  upsertSpecial = asyncHandler(async (req, res) => {
    const specialSchedule = await this.specialService.upsert(req.body, req.auth.userId, req);
    return ApiResponse.success(res, {
      message: 'Special schedule saved',
      data: { specialSchedule },
    });
  });

  deleteSpecial = asyncHandler(async (req, res) => {
    await this.specialService.softDelete(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Special schedule removed' });
  });
}

export default SchedulingController;
