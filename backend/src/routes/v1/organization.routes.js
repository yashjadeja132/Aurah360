import { Router } from 'express';
import OrganizationController from '../../controllers/OrganizationController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { updateOrganizationSchema } from '../../validators/organization.validator.js';

const router = Router();
const controller = new OrganizationController();

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.BRANCHES_VIEW, PERMISSIONS.BRANCHES_ALL), controller.get);
router.patch(
  '/',
  requirePermission(PERMISSIONS.BRANCHES_MANAGE, PERMISSIONS.BRANCHES_ALL),
  validate({ body: updateOrganizationSchema }),
  controller.update
);

export default router;
