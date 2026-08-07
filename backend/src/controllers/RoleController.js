import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import RoleService from '../services/RoleService.js';
import PermissionRepository from '../repositories/PermissionRepository.js';

class RoleController {
  constructor() {
    this.roleService = new RoleService();
    this.permissionRepository = new PermissionRepository();
  }

  listRoles = asyncHandler(async (_req, res) => {
    const roles = await this.roleService.listRoles();
    return ApiResponse.success(res, { data: { roles } });
  });

  listPermissions = asyncHandler(async (_req, res) => {
    const permissions = await this.permissionRepository.findAllGrouped();
    return ApiResponse.success(res, {
      data: {
        permissions: permissions.map((p) => p.toSafeObject()),
      },
    });
  });
}

export default RoleController;
