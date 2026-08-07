import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import UserService from '../services/UserService.js';

class UserController {
  constructor() {
    this.userService = new UserService();
  }

  list = asyncHandler(async (req, res) => {
    const result = await this.userService.listStaff(req.query);
    return ApiResponse.success(res, {
      message: 'Staff list retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  getById = asyncHandler(async (req, res) => {
    const user = await this.userService.getStaffById(req.params.id);
    return ApiResponse.success(res, { data: { user } });
  });

  create = asyncHandler(async (req, res) => {
    const user = await this.userService.createStaff(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Staff created', data: { user } });
  });

  update = asyncHandler(async (req, res) => {
    const user = await this.userService.updateStaff(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Staff updated', data: { user } });
  });

  activate = asyncHandler(async (req, res) => {
    const user = await this.userService.activateStaff(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Staff activated', data: { user } });
  });

  deactivate = asyncHandler(async (req, res) => {
    const user = await this.userService.deactivateStaff(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Staff deactivated', data: { user } });
  });

  softDelete = asyncHandler(async (req, res) => {
    const user = await this.userService.softDeleteStaff(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Staff deleted', data: { user } });
  });

  resetPassword = asyncHandler(async (req, res) => {
    await this.userService.adminResetPassword(
      req.params.id,
      req.body.newPassword,
      req.auth.userId,
      req
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
