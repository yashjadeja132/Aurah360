import ApiError from '../libs/ApiError.js';
import { ROLES } from '../constants/roles.js';
import { hasPermission } from '../helpers/permission.helper.js';
import { PERMISSIONS } from '../constants/permissions.js';

/**
 * Staff management policy helpers (used inside services or route middleware).
 */
export class UserPolicy {
  static canManageUsers(auth) {
    if (!auth) return false;
    if (auth.role === ROLES.OWNER) return true;
    return hasPermission(auth.permissions, PERMISSIONS.USERS_EDIT)
      || hasPermission(auth.permissions, PERMISSIONS.USERS_ALL);
  }

  static assertCanManageTarget(actor, target) {
    if (!actor || !target) {
      throw ApiError.forbidden();
    }
    if (target.role === ROLES.OWNER && actor.role !== ROLES.OWNER) {
      throw ApiError.forbidden('Cannot manage Owner account');
    }
    if (
      actor.role === ROLES.BRANCH_MANAGER
      && target.role === ROLES.ADMIN
    ) {
      throw ApiError.forbidden('Branch Manager cannot manage Admin accounts');
    }
  }
}

export default UserPolicy;
