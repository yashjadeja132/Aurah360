import { Router } from 'express';
import InventoryController from '../../controllers/InventoryController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  idParamSchema,
  startDispenseSchema,
  dispenseItemsSchema,
  dispenseListQuerySchema,
} from '../../validators/inventory.validator.js';

const router = Router();
const controller = new InventoryController();

const view = [PERMISSIONS.PHARMACY_VIEW, PERMISSIONS.PHARMACY_ALL];
const dispense = [
  PERMISSIONS.PHARMACY_DISPENSE,
  PERMISSIONS.PHARMACY_ALL,
];

router.use(authenticate);

router.get('/dashboard', requirePermission(...view), controller.pharmacyDashboard);
router.get('/queue', requirePermission(...view), controller.prescriptionQueue);
router.get(
  '/dispenses',
  requirePermission(...view),
  validate({ query: dispenseListQuerySchema }),
  controller.listDispenses
);
router.post(
  '/dispenses',
  requirePermission(...dispense),
  validate({ body: startDispenseSchema }),
  controller.startDispense
);
router.get(
  '/dispenses/:id',
  requirePermission(...view),
  validate({ params: idParamSchema }),
  controller.getDispense
);
router.post(
  '/dispenses/:id/dispense',
  requirePermission(...dispense),
  validate({ params: idParamSchema, body: dispenseItemsSchema }),
  controller.dispenseItems
);
router.post(
  '/dispenses/:id/cancel',
  requirePermission(...dispense),
  validate({ params: idParamSchema }),
  controller.cancelDispense
);
router.get('/reports/dispense', requirePermission(...view), controller.dispenseReport);

export default router;
