import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import ApiError from '../libs/ApiError.js';
import ReceptionService from '../services/ReceptionService.js';
import { resolveBranchScope } from '../helpers/scope.helper.js';

/**
 * The reception views are inherently single-branch, so a branch must always be resolved.
 * `resolveBranchScope` pins a branch-scoped role to its own branch (and 403s another branch), but
 * returns whatever a GLOBAL role asked for — which is `undefined` when OWNER/ADMIN omit the param.
 * Ask them explicitly rather than guessing a branch on their behalf: silently defaulting would
 * show an owner one branch's queue while implying it was the whole clinic.
 */
function requireBranchScope(req) {
  const branchId = resolveBranchScope(req);
  if (!branchId) {
    throw ApiError.badRequest(
      'branchId is required for this view. Your role can see every branch, so pick one.',
      null,
      'BRANCH_ID_REQUIRED'
    );
  }
  return branchId;
}

class ReceptionController {
  constructor() {
    this.receptionService = new ReceptionService();
  }

  dashboard = asyncHandler(async (req, res) => {
    const data = await this.receptionService.receptionDashboard({
      // Pins a non-global role to its own branch; refuses another branch with 403.
      branchId: requireBranchScope(req),
      date: req.query.date ? new Date(req.query.date) : new Date(),
    });
    return ApiResponse.success(res, { message: 'Reception dashboard', data });
  });

  todaysAppointments = asyncHandler(async (req, res) => {
    const items = await this.receptionService.todaysAppointments({
      branchId: requireBranchScope(req),
      doctorId: req.query.doctorId || null,
      date: req.query.date ? new Date(req.query.date) : new Date(),
      search: req.query.search || null,
    });
    return ApiResponse.success(res, { data: items });
  });

  checkIn = asyncHandler(async (req, res) => {
    const result = await this.receptionService.checkIn(
      req.params.appointmentId,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Patient checked in', data: result });
  });

  undoCheckIn = asyncHandler(async (req, res) => {
    const appointment = await this.receptionService.undoCheckIn(
      req.params.appointmentId,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Check-in undone', data: { appointment } });
  });

  walkIn = asyncHandler(async (req, res) => {
    const result = await this.receptionService.walkIn(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Walk-in registered', data: result });
  });
}

export default ReceptionController;
