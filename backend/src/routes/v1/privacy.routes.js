import { Router } from 'express';
import PrivacyGovernanceController from '../../controllers/PrivacyGovernanceController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { requireStepUp } from '../../middlewares/stepUp.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  breakGlassSchema,
  openPrivacyRequestSchema,
  resolvePrivacyRequestSchema,
  idParamSchema,
} from '../../validators/privacy.validator.js';

const router = Router();
const controller = new PrivacyGovernanceController();

router.use(authenticate);

router.post(
  '/break-glass',
  requirePermission(PERMISSIONS.BREAK_GLASS),
  requireStepUp(),
  validate({ body: breakGlassSchema }),
  controller.grantBreakGlass
);
router.get(
  '/break-glass',
  requirePermission(PERMISSIONS.BREAK_GLASS, PERMISSIONS.AUDIT_VIEW),
  controller.listBreakGlassGrants
);

router.post(
  '/requests',
  requirePermission(PERMISSIONS.PRIVACY_REQUEST_CREATE, PERMISSIONS.PRIVACY_REQUEST_ALL),
  validate({ body: openPrivacyRequestSchema }),
  controller.openRequest
);
router.get(
  '/requests',
  requirePermission(PERMISSIONS.PRIVACY_REQUEST_VIEW, PERMISSIONS.PRIVACY_REQUEST_ALL),
  controller.listRequests
);
router.post(
  '/requests/:id/verify-identity',
  requirePermission(PERMISSIONS.PRIVACY_REQUEST_RESOLVE, PERMISSIONS.PRIVACY_REQUEST_ALL),
  validate({ params: idParamSchema }),
  controller.verifyIdentity
);
router.post(
  '/requests/:id/resolve',
  requirePermission(PERMISSIONS.PRIVACY_REQUEST_RESOLVE, PERMISSIONS.PRIVACY_REQUEST_ALL),
  validate({ params: idParamSchema, body: resolvePrivacyRequestSchema }),
  controller.resolveRequest
);

export default router;
