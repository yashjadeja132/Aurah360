import ApiError from '../libs/ApiError.js';
import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import DoctorAvailabilityService from '../services/DoctorAvailabilityService.js';
import BranchHolidayService from '../services/BranchHolidayService.js';
import DoctorBlockedSlotService from '../services/DoctorBlockedSlotService.js';
import DoctorSpecialScheduleService from '../services/DoctorSpecialScheduleService.js';
import { scopedListQuery, resolveRecordScope } from '../helpers/scope.helper.js';

/**
 * SEC-030 — row-level branch scoping for the scheduling calendars.
 *
 * Holidays, blocked slots and special schedules all describe when a branch (or a doctor at a
 * branch) is open for business, and every one of them carries a `branchId`. Previously the handlers
 * forwarded whatever `branchId` the client typed, so a receptionist could read — and a branch
 * manager could edit — any other branch's calendar. Lists go through `scopedListQuery`; the
 * single-record writes hand the caller's scope to the service, which answers an out-of-scope id
 * with 404, and rejects an explicitly foreign `branchId` in a body with 403.
 *
 * The availability endpoints (`slots`, `check`, `validate-slot`, `weekly-preview`) are computed
 * against a branch's calendar, so the branch they compute for is pinned the same way. A doctor's
 * availability at another branch is that branch's operational data.
 */
class SchedulingController {
  constructor() {
    this.availabilityService = new DoctorAvailabilityService();
    this.holidayService = new BranchHolidayService();
    this.blockedService = new DoctorBlockedSlotService();
    this.specialService = new DoctorSpecialScheduleService();
  }

  /** The caller's branch scope for a single record/write; null for OWNER/ADMIN (unrestricted). */
  #branchScope = async (req) => (await resolveRecordScope(req, { branch: true, doctor: false })).branchId;

  /**
   * Body-carried branchId equivalent of `scopedListQuery`: the caller's branch wins, and an
   * explicitly foreign one is rejected (403) rather than silently swapped, so the client is never
   * shown an answer for a branch it did not ask about.
   */
  #scopedBodyBranch = async (req) => {
    const scope = await this.#branchScope(req);
    if (!scope) return req.body.branchId || null;
    if (req.body.branchId && String(req.body.branchId) !== String(scope)) {
      throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }
    return scope;
  };

  getAvailableSlots = asyncHandler(async (req, res) => {
    const query = await scopedListQuery(req, { branch: true });
    const result = await this.availabilityService.getAvailableSlots(
      query.doctorId,
      new Date(query.date),
      query.branchId || null
    );
    return ApiResponse.success(res, { message: 'Available slots', data: result });
  });

  checkAvailability = asyncHandler(async (req, res) => {
    const available = await this.availabilityService.isDoctorAvailable(
      req.body.doctorId,
      new Date(req.body.date),
      await this.#scopedBodyBranch(req)
    );
    return ApiResponse.success(res, { data: { available } });
  });

  validateSlot = asyncHandler(async (req, res) => {
    const result = await this.availabilityService.validateSlot(req.body.doctorId, {
      date: new Date(req.body.date),
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      branchId: await this.#scopedBodyBranch(req),
    });
    return ApiResponse.success(res, { data: result });
  });

  weeklyPreview = asyncHandler(async (req, res) => {
    const query = await scopedListQuery(req, { branch: true });
    const result = await this.availabilityService.getWeeklyPreview(
      query.doctorId,
      new Date(query.weekStart),
      query.branchId || null
    );
    return ApiResponse.success(res, { data: result });
  });

  listHolidays = asyncHandler(async (req, res) => {
    const query = await scopedListQuery(req, { branch: true });
    const holidays = await this.holidayService.list(query.branchId);
    return ApiResponse.success(res, { data: holidays });
  });

  createHoliday = asyncHandler(async (req, res) => {
    const holiday = await this.holidayService.create(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.created(res, { message: 'Holiday added', data: { holiday } });
  });

  updateHoliday = asyncHandler(async (req, res) => {
    const holiday = await this.holidayService.update(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      { branchId: await this.#branchScope(req) }
    );
    return ApiResponse.success(res, { message: 'Holiday updated', data: { holiday } });
  });

  deleteHoliday = asyncHandler(async (req, res) => {
    await this.holidayService.softDelete(req.params.id, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Holiday removed' });
  });

  listBlocked = asyncHandler(async (req, res) => {
    // The repository reads `branchId` as "this branch OR the org-wide (null-branch) blocks", which
    // is the same rule the booking path enforces — so pinning it here narrows without blinding.
    const query = await scopedListQuery(req, { branch: true });
    const items = await this.blockedService.list(query.doctorId, query);
    return ApiResponse.success(res, { data: items });
  });

  createBlocked = asyncHandler(async (req, res) => {
    const blockedSlot = await this.blockedService.create(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.created(res, { message: 'Blocked slot added', data: { blockedSlot } });
  });

  updateBlocked = asyncHandler(async (req, res) => {
    const blockedSlot = await this.blockedService.update(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      { branchId: await this.#branchScope(req) }
    );
    return ApiResponse.success(res, { message: 'Blocked slot updated', data: { blockedSlot } });
  });

  deleteBlocked = asyncHandler(async (req, res) => {
    await this.blockedService.softDelete(req.params.id, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Blocked slot removed' });
  });

  listSpecial = asyncHandler(async (req, res) => {
    const query = await scopedListQuery(req, { branch: true });
    const items = await this.specialService.list(query.doctorId, query);
    return ApiResponse.success(res, { data: items });
  });

  upsertSpecial = asyncHandler(async (req, res) => {
    const specialSchedule = await this.specialService.upsert(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, {
      message: 'Special schedule saved',
      data: { specialSchedule },
    });
  });

  deleteSpecial = asyncHandler(async (req, res) => {
    await this.specialService.softDelete(req.params.id, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Special schedule removed' });
  });
}

export default SchedulingController;
