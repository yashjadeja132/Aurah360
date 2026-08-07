import ApiError from '../libs/ApiError.js';
import { hasAnyPermission, hasAllPermissions } from '../helpers/permission.helper.js';
import { ROLES } from '../constants/roles.js';
import PrivacyGovernanceService from '../services/PrivacyGovernanceService.js';
import AuditService from '../services/AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';

const privacyGovernanceService = new PrivacyGovernanceService();
const auditService = new AuditService();

/**
 * Require one of the listed roles.
 */
export const requireRole = (...roles) => (req, _res, next) => {
  try {
    if (req.auth?.role === ROLES.OWNER) {
      return next();
    }
    if (!roles.includes(req.auth?.role)) {
      throw ApiError.forbidden('Insufficient role');
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require ANY of the listed permissions (wildcard-aware).
 */
export const requirePermission = (...requiredPermissions) => (req, _res, next) => {
  try {
    if (req.auth?.role === ROLES.OWNER) {
      return next();
    }
    const granted = req.auth?.permissions || [];
    if (!hasAnyPermission(granted, requiredPermissions)) {
      throw ApiError.forbidden('Insufficient permissions');
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require ALL listed permissions.
 */
export const requireAllPermissions = (...requiredPermissions) => (req, _res, next) => {
  try {
    if (req.auth?.role === ROLES.OWNER) {
      return next();
    }
    const granted = req.auth?.permissions || [];
    if (!hasAllPermissions(granted, requiredPermissions)) {
      throw ApiError.forbidden('Insufficient permissions');
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Require ANY of the listed permissions, OR — as a last-resort fallback when the normal
 * RBAC check would otherwise deny — a valid, non-expired break-glass grant that the
 * requesting user holds for the *exact* patient identified by `req.params[patientIdParam]`
 * (SEC-002). Break-glass never widens access beyond that single patient's record, and every
 * fallback use is audited distinctly via PHI_ACCESSED_UNDER_BREAK_GLASS so it stays
 * traceable and cannot become a silent, general-purpose RBAC bypass.
 */
export const requirePermissionOrBreakGlass = (patientIdParam, ...requiredPermissions) => (req, _res, next) => {
  (async () => {
    if (req.auth?.role === ROLES.OWNER) {
      return next();
    }

    const granted = req.auth?.permissions || [];
    if (hasAnyPermission(granted, requiredPermissions)) {
      return next();
    }

    const patientId = req.params?.[patientIdParam];
    const userId = req.auth?.userId;

    if (patientId && userId) {
      const hasBreakGlass = await privacyGovernanceService.hasValidBreakGlass(userId, patientId);
      if (hasBreakGlass) {
        req.breakGlassAccess = true;
        await auditService.record(AUDIT_ACTIONS.PHI_ACCESSED_UNDER_BREAK_GLASS, {
          actorId: userId,
          metadata: { patientId, route: req.originalUrl, method: req.method },
          req,
        });
        return next();
      }
    }

    throw ApiError.forbidden('Insufficient permissions');
  })().catch(next);
};

export default requirePermission;
