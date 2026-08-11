import { Router } from 'express';
import StaffRosterController from '../../controllers/StaffRosterController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  rosterQuerySchema,
  staffLeaveParamSchema,
  staffLeaveIdParamSchema,
  createStaffLeaveSchema,
} from '../../validators/staffRoster.validator.js';

const router = Router();
const controller = new StaffRosterController();

router.use(authenticate);

// Same reach as the existing Staff list screen — no new permission constant, so no Role-DB
// re-sync is needed for this fix.
router.get(
  '/today',
  requirePermission(PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_ALL),
  validate({ query: rosterQuerySchema }),
  controller.today
);

router.get(
  '/:userId/leaves',
  requirePermission(PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_ALL),
  validate({ params: staffLeaveParamSchema }),
  controller.listLeaves
);

router.post(
  '/:userId/leaves',
  requirePermission(PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_ALL),
  validate({ params: staffLeaveParamSchema, body: createStaffLeaveSchema }),
  controller.markLeave
);

router.delete(
  '/:userId/leaves/:leaveId',
  requirePermission(PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_ALL),
  validate({ params: staffLeaveIdParamSchema }),
  controller.deleteLeave
);

export default router;
