import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import StaffRosterService from '../services/StaffRosterService.js';
import StaffLeaveService from '../services/StaffLeaveService.js';
import { scopedListQuery } from '../helpers/scope.helper.js';

/**
 * Branch Manager "Staff/Rosters" board (see StaffRosterService header). Row-scoped like every
 * other branch-dimensioned list in this app: a branch-scoped caller's `branchId` comes from
 * their token, never from raw client input.
 */
class StaffRosterController {
  constructor() {
    this.rosterService = new StaffRosterService();
    this.staffLeaveService = new StaffLeaveService();
  }

  today = asyncHandler(async (req, res) => {
    const scoped = await scopedListQuery(req, { branch: true });
    const roster = await this.rosterService.today(
      scoped.branchId || null,
      scoped.date ? new Date(scoped.date) : new Date()
    );
    return ApiResponse.success(res, { message: 'Staff roster retrieved', data: { roster } });
  });

  listLeaves = asyncHandler(async (req, res) => {
    const leaves = await this.staffLeaveService.list(req.params.userId);
    return ApiResponse.success(res, { message: 'Staff leaves retrieved', data: { leaves } });
  });

  markLeave = asyncHandler(async (req, res) => {
    const leave = await this.staffLeaveService.create(
      req.params.userId,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.created(res, { message: 'Leave/blocked marked', data: { leave } });
  });

  deleteLeave = asyncHandler(async (req, res) => {
    await this.staffLeaveService.softDelete(req.params.userId, req.params.leaveId, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Leave removed' });
  });
}

export default StaffRosterController;
