import { Router } from 'express';
import UserController from '../../controllers/UserController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  createStaffSchema,
  updateStaffSchema,
  listStaffQuerySchema,
  idParamSchema,
  resetPasswordSchema,
  deactivateStaffSchema,
} from '../../validators/user.validator.js';

const router = Router();
const userController = new UserController();

router.use(authenticate);

router.get(
  '/',
  requirePermission(PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_ALL),
  validate({ query: listStaffQuerySchema }),
  userController.list
);

router.post(
  '/',
  requirePermission(PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_ALL),
  validate({ body: createStaffSchema }),
  userController.create
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_ALL),
  validate({ params: idParamSchema }),
  userController.getById
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_ALL),
  validate({ params: idParamSchema, body: updateStaffSchema }),
  userController.update
);

router.post(
  '/:id/activate',
  requirePermission(PERMISSIONS.USERS_ACTIVATE, PERMISSIONS.USERS_ALL),
  validate({ params: idParamSchema }),
  userController.activate
);

router.post(
  '/:id/deactivate',
  requirePermission(PERMISSIONS.USERS_ACTIVATE, PERMISSIONS.USERS_ALL),
  validate({ params: idParamSchema, body: deactivateStaffSchema }),
  userController.deactivate
);

router.delete(
  '/:id',
  requirePermission(PERMISSIONS.USERS_DELETE, PERMISSIONS.USERS_ALL),
  validate({ params: idParamSchema, body: deactivateStaffSchema }),
  userController.softDelete
);

router.post(
  '/:id/reset-password',
  requirePermission(PERMISSIONS.USERS_RESET_PASSWORD, PERMISSIONS.USERS_ALL),
  validate({ params: idParamSchema, body: resetPasswordSchema }),
  userController.resetPassword
);

export default router;
