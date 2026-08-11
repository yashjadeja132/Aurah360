import { Router } from 'express';
import RoleController from '../../controllers/RoleController.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';

const router = Router();
const roleController = new RoleController();

router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.ROLES_VIEW, PERMISSIONS.ROLES_ALL, PERMISSIONS.USERS_VIEW),
  roleController.listRoles
);

router.get(
  '/permissions',
  requirePermission(PERMISSIONS.ROLES_VIEW, PERMISSIONS.ROLES_ALL, PERMISSIONS.USERS_CREATE),
  roleController.listPermissions
);

// §2.1 — role-template staff creation: default permission bundle per role.
router.get(
  '/templates',
  requirePermission(PERMISSIONS.ROLES_VIEW, PERMISSIONS.ROLES_ALL, PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_EDIT),
  roleController.listRoleTemplates
);

export default router;
