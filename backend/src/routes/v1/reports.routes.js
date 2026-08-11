import { Router } from 'express';
import ReportController from '../../controllers/ReportController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { requireStepUp } from '../../middlewares/stepUp.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  idParamSchema,
  dashboardParamSchema,
  reportTypeParamSchema,
  chartTypeParamSchema,
  filterQuerySchema,
  createScheduleSchema,
  updateScheduleSchema,
  saveFilterSchema,
  queueExportSchema,
} from '../../validators/report.validator.js';

const router = Router();
const controller = new ReportController();

const view = [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_ALL];
const exportPerm = [PERMISSIONS.REPORTS_EXPORT, PERMISSIONS.REPORTS_ALL];
const schedule = [PERMISSIONS.REPORTS_SCHEDULE, PERMISSIONS.REPORTS_ALL];

router.use(authenticate);

router.get(
  '/dashboards/:type',
  requirePermission(...view),
  validate({ params: dashboardParamSchema, query: filterQuerySchema }),
  controller.dashboard
);

router.get(
  '/analytics',
  requirePermission(...view),
  validate({ query: filterQuerySchema }),
  controller.analytics
);

router.get(
  '/kpis',
  requirePermission(...view),
  validate({ query: filterQuerySchema }),
  controller.kpis
);

router.get(
  '/charts/:type',
  requirePermission(...view),
  validate({ params: chartTypeParamSchema, query: filterQuerySchema }),
  controller.chart
);

router.get(
  '/generate/:type',
  requirePermission(...view),
  validate({ params: reportTypeParamSchema, query: filterQuerySchema }),
  controller.generate
);

// SEC-002 — report exports can carry PHI/financial detail (revenue, dues, patient volumes);
// step-up is required unconditionally, matching the loyalty settings pattern above.
router.get(
  '/export/:type',
  requirePermission(...exportPerm),
  requireStepUp(),
  validate({ params: reportTypeParamSchema, query: filterQuerySchema }),
  controller.exportReport
);

router.post(
  '/export/:type/queue',
  requirePermission(...exportPerm),
  requireStepUp(),
  validate({ params: reportTypeParamSchema, body: queueExportSchema }),
  controller.queueExport
);

router.get(
  '/runs/:id',
  requirePermission(...view),
  validate({ params: idParamSchema }),
  controller.getRun
);

router.get(
  '/runs/:id/download',
  requirePermission(...view),
  validate({ params: idParamSchema }),
  controller.downloadRun
);

router.get('/scheduled', requirePermission(...view), controller.listScheduled);
router.post(
  '/scheduled/run-due',
  requirePermission(...schedule),
  controller.runDueScheduled
);
router.post(
  '/scheduled',
  requirePermission(...schedule),
  validate({ body: createScheduleSchema }),
  controller.createScheduled
);
router.patch(
  '/scheduled/:id',
  requirePermission(...schedule),
  validate({ params: idParamSchema, body: updateScheduleSchema }),
  controller.updateScheduled
);
router.delete(
  '/scheduled/:id',
  requirePermission(...schedule),
  validate({ params: idParamSchema }),
  controller.deleteScheduled
);

router.get('/saved-filters', requirePermission(...view), controller.listSavedFilters);
router.post(
  '/saved-filters',
  requirePermission(...view),
  validate({ body: saveFilterSchema }),
  controller.saveFilter
);
router.delete(
  '/saved-filters/:id',
  requirePermission(...view),
  validate({ params: idParamSchema }),
  controller.deleteSavedFilter
);

export default router;
