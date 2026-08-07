import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import InventoryService from '../services/InventoryService.js';
import PurchaseService from '../services/PurchaseService.js';
import PharmacyService from '../services/PharmacyService.js';

class InventoryController {
  constructor() {
    this.inventory = new InventoryService();
    this.purchase = new PurchaseService();
    this.pharmacy = new PharmacyService();
  }

  // Inventory
  dashboard = asyncHandler(async (req, res) => {
    const data = await this.inventory.dashboard(req.query.branchId || null);
    return ApiResponse.success(res, { data });
  });

  listItems = asyncHandler(async (req, res) => {
    const result = await this.inventory.listItems(req.query);
    return ApiResponse.success(res, {
      message: 'Inventory items',
      data: result.items,
      meta: result.meta,
    });
  });

  createItem = asyncHandler(async (req, res) => {
    const item = await this.inventory.createItem(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Item created', data: { item } });
  });

  getItem = asyncHandler(async (req, res) => {
    const item = await this.inventory.getItem(req.params.id);
    return ApiResponse.success(res, { data: { item } });
  });

  updateItem = asyncHandler(async (req, res) => {
    const item = await this.inventory.updateItem(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Item updated', data: { item } });
  });

  openingStock = asyncHandler(async (req, res) => {
    const data = await this.inventory.openingStock(req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Opening stock posted', data });
  });

  adjust = asyncHandler(async (req, res) => {
    const data = await this.inventory.adjust(req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Stock adjusted', data });
  });

  transfer = asyncHandler(async (req, res) => {
    const data = await this.inventory.transfer(req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Stock transferred', data });
  });

  requestTransfer = asyncHandler(async (req, res) => {
    const transfer = await this.inventory.requestTransfer(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Transfer requested', data: { transfer } });
  });

  approveTransfer = asyncHandler(async (req, res) => {
    const transfer = await this.inventory.approveTransfer(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Transfer approved', data: { transfer } });
  });

  rejectTransfer = asyncHandler(async (req, res) => {
    const transfer = await this.inventory.rejectTransfer(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Transfer rejected', data: { transfer } });
  });

  dispatchTransfer = asyncHandler(async (req, res) => {
    const transfer = await this.inventory.dispatchTransfer(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Transfer dispatched', data: { transfer } });
  });

  receiveTransfer = asyncHandler(async (req, res) => {
    const transfer = await this.inventory.receiveTransfer(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Transfer received', data: { transfer } });
  });

  listTransfers = asyncHandler(async (req, res) => {
    const transfers = await this.inventory.listTransfers(req.query);
    return ApiResponse.success(res, { message: 'Transfers retrieved', data: { transfers } });
  });

  getTransfer = asyncHandler(async (req, res) => {
    const transfer = await this.inventory.getTransfer(req.params.id);
    return ApiResponse.success(res, { message: 'Transfer retrieved', data: { transfer } });
  });

  stockCount = asyncHandler(async (req, res) => {
    const data = await this.inventory.stockCount(req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Stock count applied', data });
  });

  returnStock = asyncHandler(async (req, res) => {
    const data = await this.inventory.returnStock(req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Stock returned', data });
  });

  consume = asyncHandler(async (req, res) => {
    const data = await this.inventory.consumeForTreatment({
      ...req.body,
      actorId: req.auth.userId,
      req,
    });
    return ApiResponse.success(res, { message: 'Stock consumed', data });
  });

  ledger = asyncHandler(async (req, res) => {
    const result = await this.inventory.ledger(req.query);
    return ApiResponse.success(res, {
      message: 'Stock ledger',
      data: result.items,
      meta: result.meta,
    });
  });

  report = asyncHandler(async (req, res) => {
    const data = await this.inventory.reports(req.params.type, req.query);
    return ApiResponse.success(res, { data });
  });

  // Suppliers
  listSuppliers = asyncHandler(async (req, res) => {
    const result = await this.purchase.listSuppliers(req.query);
    return ApiResponse.success(res, { data: result.items, meta: result.meta });
  });

  createSupplier = asyncHandler(async (req, res) => {
    const supplier = await this.purchase.createSupplier(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Supplier created', data: { supplier } });
  });

  getSupplier = asyncHandler(async (req, res) => {
    const supplier = await this.purchase.getSupplier(req.params.id);
    return ApiResponse.success(res, { data: { supplier } });
  });

  updateSupplier = asyncHandler(async (req, res) => {
    const supplier = await this.purchase.updateSupplier(
      req.params.id,
      req.body,
      req.auth.userId
    );
    return ApiResponse.success(res, { message: 'Supplier updated', data: { supplier } });
  });

  deleteSupplier = asyncHandler(async (req, res) => {
    const data = await this.purchase.softDeleteSupplier(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Supplier deleted', data });
  });

  // Purchase orders
  listPos = asyncHandler(async (req, res) => {
    const result = await this.purchase.listPos(req.query);
    return ApiResponse.success(res, { data: result.items, meta: result.meta });
  });

  createPo = asyncHandler(async (req, res) => {
    const po = await this.purchase.createPo(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Purchase order created', data: { po } });
  });

  getPo = asyncHandler(async (req, res) => {
    const po = await this.purchase.getPo(req.params.id);
    return ApiResponse.success(res, { data: { po } });
  });

  submitPo = asyncHandler(async (req, res) => {
    const po = await this.purchase.submitPo(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'PO submitted', data: { po } });
  });

  // GRN
  listGrns = asyncHandler(async (req, res) => {
    const result = await this.purchase.listGrns(req.query);
    return ApiResponse.success(res, { data: result.items, meta: result.meta });
  });

  createGrn = asyncHandler(async (req, res) => {
    const grn = await this.purchase.createGrn(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'GRN created', data: { grn } });
  });

  getGrn = asyncHandler(async (req, res) => {
    const grn = await this.purchase.getGrn(req.params.id);
    return ApiResponse.success(res, { data: { grn } });
  });

  postGrn = asyncHandler(async (req, res) => {
    const grn = await this.purchase.postGrn(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Goods received', data: { grn } });
  });

  purchaseReport = asyncHandler(async (req, res) => {
    const data = await this.purchase.purchaseReport(req.query);
    return ApiResponse.success(res, { data });
  });

  // Pharmacy
  pharmacyDashboard = asyncHandler(async (req, res) => {
    const data = await this.pharmacy.dashboard(req.query.branchId || null);
    return ApiResponse.success(res, { data });
  });

  prescriptionQueue = asyncHandler(async (req, res) => {
    const data = await this.pharmacy.prescriptionQueue(req.query);
    return ApiResponse.success(res, { data });
  });

  listDispenses = asyncHandler(async (req, res) => {
    const result = await this.pharmacy.listDispenses(req.query);
    return ApiResponse.success(res, { data: result.items, meta: result.meta });
  });

  startDispense = asyncHandler(async (req, res) => {
    const dispense = await this.pharmacy.startDispense(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Dispense started', data: { dispense } });
  });

  getDispense = asyncHandler(async (req, res) => {
    const dispense = await this.pharmacy.getDispense(req.params.id);
    return ApiResponse.success(res, { data: { dispense } });
  });

  dispenseItems = asyncHandler(async (req, res) => {
    const dispense = await this.pharmacy.dispenseItems(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Medicines dispensed', data: { dispense } });
  });

  cancelDispense = asyncHandler(async (req, res) => {
    const dispense = await this.pharmacy.cancelDispense(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Dispense cancelled', data: { dispense } });
  });

  dispenseReport = asyncHandler(async (req, res) => {
    const data = await this.pharmacy.dispenseReport(req.query);
    return ApiResponse.success(res, { data });
  });
}

export default InventoryController;
