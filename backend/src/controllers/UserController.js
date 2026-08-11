import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import UserService from '../services/UserService.js';
import { resolveRecordScope } from '../helpers/scope.helper.js';

/**
 * SEC-030 — the staff directory is branch-scoped. `User.branch` is a single Branch ref, so
 * scoping is plain equality.
 *
 * DECISION: a BRANCH_MANAGER sees their OWN branch's staff only; OWNER/ADMIN see everyone.
 * BRANCH_MANAGER is the only non-global role holding `users.view`, and it also holds
 * USERS_CREATE, USERS_EDIT, USERS_ACTIVATE and (where granted) USERS_RESET_PASSWORD. Before
 * this, the manager of one site could enumerate every employee in the organisation — email,
 * phone, employee id, role — and, worse, DEACTIVATE or RESET THE PASSWORD OF any of them,
 * including another branch's manager or an admin. Staff administration is per-site by
 * definition; there is no screen where a branch manager legitimately administers another
 * branch's people, so nothing is lost by pinning it.
 *
 * Note the field name: `User.branch`, not `branchId`. The service translates the scope helper's
 * `branchId` onto it rather than the repository learning a second spelling.
 *
 * `changePassword` and `updateProfile` act on `req.auth.userId` and are self-service, so they
 * carry no scope of their own.
 */
class UserController {
  constructor() {
    this.userService = new UserService();
  }

  list = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const result = await this.userService.listStaff(req.query, { branchId });
    return ApiResponse.success(res, {
      message: 'Staff list retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  getById = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const user = await this.userService.getStaffById(req.params.id, scope);
    return ApiResponse.success(res, { data: { user } });
  });

  create = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const user = await this.userService.createStaff(req.body, req.auth.userId, req, scope);
    return ApiResponse.created(res, { message: 'Staff created', data: { user } });
  });

  update = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const user = await this.userService.updateStaff(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      scope
    );
    return ApiResponse.success(res, { message: 'Staff updated', data: { user } });
  });

  activate = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const user = await this.userService.activateStaff(req.params.id, req.auth.userId, req, scope);
    return ApiResponse.success(res, { message: 'Staff activated', data: { user } });
  });

  deactivate = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const user = await this.userService.deactivateStaff(req.params.id, req.auth.userId, req, {
      ...scope,
      reassignToUserId: req.body?.reassignToUserId || null,
    });
    return ApiResponse.success(res, { message: 'Staff deactivated', data: { user } });
  });

  softDelete = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const user = await this.userService.softDeleteStaff(req.params.id, req.auth.userId, req, {
      ...scope,
      reassignToUserId: req.body?.reassignToUserId || null,
    });
    return ApiResponse.success(res, { message: 'Staff deleted', data: { user } });
  });

  resetPassword = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    await this.userService.adminResetPassword(
      req.params.id,
      req.body.newPassword,
      req.auth.userId,
      req,
      scope
    );
    return ApiResponse.success(res, { message: 'Password reset successfully' });
  });

  changePassword = asyncHandler(async (req, res) => {
    await this.userService.changePassword(req.auth.userId, req.body, req);
    return ApiResponse.success(res, { message: 'Password changed successfully' });
  });

  updateProfile = asyncHandler(async (req, res) => {
    const user = await this.userService.updateProfile(req.auth.userId, req.body, req);
    return ApiResponse.success(res, { message: 'Profile updated', data: { user } });
  });
}

export default UserController;
