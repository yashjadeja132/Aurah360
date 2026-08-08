import { Router } from 'express';
import AuditController from '../../controllers/AuditController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { searchAuditLogQuerySchema } from '../../validators/audit.validator.js';

const router = Router();
const controller = new AuditController();

router.use(authenticate);

/**
 * NFR-018 — GET /audit/entries. Only AUDIT_VIEW opens this; unlike most list routes there is no
 * second, broader permission accepted as an alternative, because there is no wildcard that should
 * imply a right to read the whole organisation's audit trail.
 */
router.get(
  '/entries',
  requirePermission(PERMISSIONS.AUDIT_VIEW),
  validate({ query: searchAuditLogQuerySchema }),
  controller.search
);

export default router;
