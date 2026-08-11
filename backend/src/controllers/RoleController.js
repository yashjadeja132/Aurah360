import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import RoleService from '../services/RoleService.js';
import PermissionRepository from '../repositories/PermissionRepository.js';
import { ROLE_PERMISSIONS } from '../constants/rolePermissions.js';
import { ROLES } from '../constants/roles.js';

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

  /**
   * §2.1 — role-template staff creation. Surfaces the existing per-role default permission
   * arrays from constants/rolePermissions.js so the staff-create form can pre-check a sensible
   * bundle for whichever role the admin picks. OWNER is excluded — its wildcard set is not an
   * assignable staff template (staff creation already forbids the Owner role outright).
   */
  listRoleTemplates = asyncHandler(async (_req, res) => {
    const templates = Object.fromEntries(
      Object.entries(ROLE_PERMISSIONS).filter(([role]) => role !== ROLES.OWNER)
    );
    return ApiResponse.success(res, { data: { templates } });
  });
}

export default RoleController;
