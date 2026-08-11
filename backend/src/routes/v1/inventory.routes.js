import { Router } from 'express';
import InventoryController from '../../controllers/InventoryController.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { requirePermission } from '../../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  idParamSchema,
  itemListQuerySchema,
  createItemSchema,
  updateItemSchema,
  openingStockSchema,
  adjustSchema,
  transferSchema,
  stockCountSchema,
  consumeSchema,
  ledgerQuerySchema,
  supplierSchema,
  createPoSchema,
  createGrnSchema,
  poListQuerySchema,
  reportTypeParamSchema,
  requestTransferSchema,
  rejectTransferSchema,
  dispatchTransferSchema,
  receiveTransferSchema,
  transferIdParamSchema,
  rejectAdjustmentSchema,
  adjustmentIdParamSchema,
  markDamagedSchema,
  returnToVendorSchema,
} from '../../validators/inventory.validator.js';

const router = Router();
const controller = new InventoryController();

const view = [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_ALL];
const edit = [PERMISSIONS.INVENTORY_EDIT, PERMISSIONS.INVENTORY_CREATE, PERMISSIONS.INVENTORY_ALL];
const adjust = [
  PERMISSIONS.INVENTORY_ADJUST,
  PERMISSIONS.STOCK_ADJUST,
  PERMISSIONS.INVENTORY_ALL,
];
const purchase = [
  PERMISSIONS.PURCHASE_CREATE,
  PERMISSIONS.PURCHASE_VIEW,
  PERMISSIONS.PURCHASE_ALL,
  PERMISSIONS.INVENTORY_ALL,
];

router.use(authenticate);

router.get('/dashboard', requirePermission(...view), controller.dashboard);
router.get(
  '/items',
  requirePermission(...view),
  validate({ query: itemListQuerySchema }),
  controller.listItems
);
router.post(
  '/items',
  requirePermission(...edit),
  validate({ body: createItemSchema }),
  controller.createItem
);
router.get(
  '/items/:id',
  requirePermission(...view),
  validate({ params: idParamSchema }),
  controller.getItem
);
router.patch(
  '/items/:id',
  requirePermission(...edit),
  validate({ params: idParamSchema, body: updateItemSchema }),
  controller.updateItem
);

router.post(
  '/opening-stock',
  requirePermission(...adjust),
  validate({ body: openingStockSchema }),
  controller.openingStock
);
router.post(
  '/adjust',
  requirePermission(...adjust),
  validate({ body: adjustSchema }),
  controller.adjust
);
router.post(
  '/transfer',
  requirePermission(...adjust),
  validate({ body: transferSchema }),
  controller.transfer
);

router.post(
  '/transfers',
  requirePermission(PERMISSIONS.INVENTORY_TRANSFER_REQUEST, PERMISSIONS.INVENTORY_ALL),
  validate({ body: requestTransferSchema }),
  controller.requestTransfer
);
router.get(
  '/transfers',
  requirePermission(...view),
  controller.listTransfers
);
router.get(
  '/transfers/:id',
  requirePermission(...view),
  validate({ params: transferIdParamSchema }),
  controller.getTransfer
);
router.post(
  '/transfers/:id/approve',
  requirePermission(PERMISSIONS.INVENTORY_TRANSFER_APPROVE, PERMISSIONS.INVENTORY_ALL),
  validate({ params: transferIdParamSchema }),
  controller.approveTransfer
);
router.post(
  '/transfers/:id/reject',
  requirePermission(PERMISSIONS.INVENTORY_TRANSFER_APPROVE, PERMISSIONS.INVENTORY_ALL),
  validate({ params: transferIdParamSchema, body: rejectTransferSchema }),
  controller.rejectTransfer
);
router.post(
  '/transfers/:id/dispatch',
  requirePermission(PERMISSIONS.INVENTORY_TRANSFER_APPROVE, PERMISSIONS.INVENTORY_ALL),
  validate({ params: transferIdParamSchema, body: dispatchTransferSchema }),
  controller.dispatchTransfer
);
router.post(
  '/transfers/:id/receive',
  requirePermission(PERMISSIONS.INVENTORY_TRANSFER_RECEIVE, PERMISSIONS.INVENTORY_ALL),
  validate({ params: transferIdParamSchema, body: receiveTransferSchema }),
  controller.receiveTransfer
);
// Stock adjustment approval queue (INV-003) — unusual adjustments only; see InventoryService#adjust.
router.get(
  '/adjustments',
  requirePermission(...view),
  controller.listAdjustmentRequests
);
router.get(
  '/adjustments/:id',
  requirePermission(...view),
  validate({ params: adjustmentIdParamSchema }),
  controller.getAdjustmentRequest
);
router.post(
  '/adjustments/:id/approve',
  requirePermission(PERMISSIONS.INVENTORY_ADJUST_APPROVE, PERMISSIONS.INVENTORY_ALL),
  validate({ params: adjustmentIdParamSchema }),
  controller.approveAdjustmentRequest
);
router.post(
  '/adjustments/:id/reject',
  requirePermission(PERMISSIONS.INVENTORY_ADJUST_APPROVE, PERMISSIONS.INVENTORY_ALL),
  validate({ params: adjustmentIdParamSchema, body: rejectAdjustmentSchema }),
  controller.rejectAdjustmentRequest
);

router.post(
  '/stock-count',
  requirePermission(...adjust),
  validate({ body: stockCountSchema }),
  controller.stockCount
);
router.post(
  '/return',
  requirePermission(...adjust),
  validate({ body: adjustSchema }),
  controller.returnStock
);
router.post(
  '/mark-damaged',
  requirePermission(...adjust),
  validate({ body: markDamagedSchema }),
  controller.markDamaged
);
router.post(
  '/return-to-vendor',
  requirePermission(...adjust, ...purchase),
  validate({ body: returnToVendorSchema }),
  controller.returnToVendor
);
router.post(
  '/consume',
  requirePermission(...adjust, PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL),
  validate({ body: consumeSchema }),
  controller.consume
);

router.get(
  '/ledger',
  requirePermission(...view),
  validate({ query: ledgerQuerySchema }),
  controller.ledger
);
router.get(
  '/reports/:type',
  requirePermission(...view),
  validate({ params: reportTypeParamSchema }),
  controller.report
);
// INV-REPORT-EXPORT — mirrors the generic Reports module's `GET /reports/export/:type`
// (requirePermission(REPORTS_EXPORT/REPORTS_ALL) pattern); gated on REPORTS_EXPORT or the
// INVENTORY_ALL wildcard since this is inventory's own report set, not the generic module's.
router.get(
  '/reports/:type/export',
  requirePermission(PERMISSIONS.REPORTS_EXPORT, PERMISSIONS.INVENTORY_ALL),
  validate({ params: reportTypeParamSchema }),
  controller.reportExport
);

// Suppliers
router.get('/suppliers', requirePermission(...view, ...purchase), controller.listSuppliers);
router.post(
  '/suppliers',
  requirePermission(...purchase),
  validate({ body: supplierSchema }),
  controller.createSupplier
);
router.get(
  '/suppliers/:id',
  requirePermission(...view, ...purchase),
  validate({ params: idParamSchema }),
  controller.getSupplier
);
router.patch(
  '/suppliers/:id',
  requirePermission(...purchase),
  validate({ params: idParamSchema, body: supplierSchema.partial() }),
  controller.updateSupplier
);
router.delete(
  '/suppliers/:id',
  requirePermission(...purchase),
  validate({ params: idParamSchema }),
  controller.deleteSupplier
);

// Purchase orders
router.get(
  '/purchase-orders',
  requirePermission(...view, ...purchase),
  validate({ query: poListQuerySchema }),
  controller.listPos
);
router.post(
  '/purchase-orders',
  requirePermission(...purchase),
  validate({ body: createPoSchema }),
  controller.createPo
);
router.get(
  '/purchase-orders/:id',
  requirePermission(...view, ...purchase),
  validate({ params: idParamSchema }),
  controller.getPo
);
router.post(
  '/purchase-orders/:id/submit',
  requirePermission(...purchase),
  validate({ params: idParamSchema }),
  controller.submitPo
);

// Goods receipts
router.get('/goods-receipts', requirePermission(...view, ...purchase), controller.listGrns);
router.post(
  '/goods-receipts',
  requirePermission(...purchase),
  validate({ body: createGrnSchema }),
  controller.createGrn
);
router.get(
  '/goods-receipts/:id',
  requirePermission(...view, ...purchase),
  validate({ params: idParamSchema }),
  controller.getGrn
);
router.post(
  '/goods-receipts/:id/post',
  requirePermission(...purchase, ...adjust),
  validate({ params: idParamSchema }),
  controller.postGrn
);

router.get('/purchase-report', requirePermission(...view, ...purchase), controller.purchaseReport);

export default router;
