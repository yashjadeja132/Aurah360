import { Router } from 'express';
import AnalyticsController from '../../controllers/AnalyticsController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  categoryParamSchema,
  analyticsQuerySchema,
  queueExportSchema,
} from '../../validators/analytics.validator.js';

const router = Router();
const controller = new AnalyticsController();

const view = [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_ALL, PERMISSIONS.DASHBOARD_VIEW];
const exportPerm = [PERMISSIONS.REPORTS_EXPORT, PERMISSIONS.REPORTS_ALL];
const dash = [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_ALL];

router.use(authenticate);

router.get(
  '/dashboard',
  requirePermission(...dash),
  validate({ query: analyticsQuerySchema }),
  controller.dashboard
);

router.get(
  '/reports/:category',
  requirePermission(...view),
  validate({ params: categoryParamSchema, query: analyticsQuerySchema }),
  controller.report
);

router.get(
  '/reports/:category/export',
  requirePermission(...exportPerm),
  validate({ params: categoryParamSchema, query: analyticsQuerySchema }),
  controller.export
);

router.post(
  '/reports/:category/export/queue',
  requirePermission(...exportPerm),
  validate({ params: categoryParamSchema, body: queueExportSchema }),
  controller.queueExport
);

export default router;
