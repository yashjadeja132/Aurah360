import { Router } from 'express';
import BillingOpsController from '../../controllers/BillingOpsController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { submitCashCloseSchema, createFeeScheduleSchema, idParamSchema } from '../../validators/billingOps.validator.js';

const router = Router();
const controller = new BillingOpsController();

router.use(authenticate);

router.post(
  '/cash-close',
  requirePermission(PERMISSIONS.BILLING_CASH_CLOSE, PERMISSIONS.BILLING_ALL),
  validate({ body: submitCashCloseSchema }),
  controller.submitCashClose
);
router.get(
  '/cash-close',
  requirePermission(PERMISSIONS.BILLING_VIEW, PERMISSIONS.BILLING_ALL),
  controller.listCashCloses
);
router.post(
  '/cash-close/:id/approve',
  requirePermission(PERMISSIONS.BILLING_CASH_CLOSE_APPROVE, PERMISSIONS.BILLING_ALL),
  validate({ params: idParamSchema }),
  controller.approveCashClose
);

router.get(
  '/fee-schedules',
  requirePermission(PERMISSIONS.BILLING_VIEW, PERMISSIONS.BILLING_ALL),
  controller.listFeeSchedules
);
router.get(
  '/fee-schedules/resolve',
  requirePermission(PERMISSIONS.BILLING_VIEW, PERMISSIONS.BILLING_ALL, PERMISSIONS.BILLING_CREATE),
  controller.resolvePrice
);
router.post(
  '/fee-schedules',
  requirePermission(PERMISSIONS.BILLING_EDIT, PERMISSIONS.BILLING_ALL),
  validate({ body: createFeeScheduleSchema }),
  controller.createFeeSchedule
);
router.post(
  '/fee-schedules/:id/deactivate',
  requirePermission(PERMISSIONS.BILLING_EDIT, PERMISSIONS.BILLING_ALL),
  validate({ params: idParamSchema }),
  controller.deactivateFeeSchedule
);

export default router;
