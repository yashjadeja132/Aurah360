import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import InventoryService from '../services/InventoryService.js';
import PurchaseService from '../services/PurchaseService.js';
import PharmacyService from '../services/PharmacyService.js';
import { scopedListQuery, resolveRecordScope } from '../helpers/scope.helper.js';

/**
 * SEC-030 — row-level branch scoping for stock, purchasing and pharmacy.
 *
 * Every screen here reads or moves PHYSICAL stock, which belongs to exactly one branch. Before
 * this, each handler passed `req.query` straight through, so a branch-scoped storekeeper,
 * pharmacist or branch manager browsed (and could adjust or dispense) every other branch's
 * inventory. Lists go through `scopedListQuery`; single-record reads and writes resolve the
 * caller's scope with `resolveRecordScope` and hand the `branchId` to the service, which answers
 * an out-of-scope id with 404 rather than 403.
 *
 * Two deliberate exceptions:
 *   - SUPPLIERS are organisation-wide. `Supplier` carries no `branchId` — it is a shared vendor
 *     master every branch orders against — so there is no branch dimension to scope on.
 *   - TRANSFERS are inherently cross-branch. Scoping them to `branchId === mine` would hide every
 *     INBOUND transfer from the branch waiting to receive it, so the rule is "my branch is a PARTY
 *     to this transfer" (source or destination). The two stock-moving steps are narrower still:
 *     only the source may dispatch, only the destination may receive.
 */
class InventoryController {
  constructor() {
    this.inventory = new InventoryService();
    this.purchase = new PurchaseService();
    this.pharmacy = new PharmacyService();
  }

  /** The caller's branch scope for a single record/write; null for OWNER/ADMIN (unrestricted). */
  #branchScope = async (req) => (await resolveRecordScope(req, { branch: true, doctor: false })).branchId;

  // Inventory
  dashboard = asyncHandler(async (req, res) => {
    const query = await scopedListQuery(req, { branch: true });
    const data = await this.inventory.dashboard(query.branchId || null);
    return ApiResponse.success(res, { data });
  });

  listItems = asyncHandler(async (req, res) => {
    const result = await this.inventory.listItems(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, {
      message: 'Inventory items',
      data: result.items,
      meta: result.meta,
    });
  });

  createItem = asyncHandler(async (req, res) => {
    const item = await this.inventory.createItem(req.body, req.auth.userId, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.created(res, { message: 'Item created', data: { item } });
  });

  getItem = asyncHandler(async (req, res) => {
    const item = await this.inventory.getItem(req.params.id, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { data: { item } });
  });

  updateItem = asyncHandler(async (req, res) => {
    const item = await this.inventory.updateItem(req.params.id, req.body, req.auth.userId, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Item updated', data: { item } });
  });

  openingStock = asyncHandler(async (req, res) => {
    const data = await this.inventory.openingStock(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Opening stock posted', data });
  });

  adjust = asyncHandler(async (req, res) => {
    const data = await this.inventory.adjust(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Stock adjusted', data });
  });

  transfer = asyncHandler(async (req, res) => {
    const data = await this.inventory.transfer(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Stock transferred', data });
  });

  requestTransfer = asyncHandler(async (req, res) => {
    const transfer = await this.inventory.requestTransfer(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.created(res, { message: 'Transfer requested', data: { transfer } });
  });

  approveTransfer = asyncHandler(async (req, res) => {
    const transfer = await this.inventory.approveTransfer(req.params.id, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Transfer approved', data: { transfer } });
  });

  rejectTransfer = asyncHandler(async (req, res) => {
    const transfer = await this.inventory.rejectTransfer(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      { branchId: await this.#branchScope(req) }
    );
    return ApiResponse.success(res, { message: 'Transfer rejected', data: { transfer } });
  });

  dispatchTransfer = asyncHandler(async (req, res) => {
    const transfer = await this.inventory.dispatchTransfer(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      { branchId: await this.#branchScope(req) }
    );
    return ApiResponse.success(res, { message: 'Transfer dispatched', data: { transfer } });
  });

  receiveTransfer = asyncHandler(async (req, res) => {
    const transfer = await this.inventory.receiveTransfer(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      { branchId: await this.#branchScope(req) }
    );
    return ApiResponse.success(res, { message: 'Transfer received', data: { transfer } });
  });

  listTransfers = asyncHandler(async (req, res) => {
    // `InventoryService#listTransfers` turns `branchId` into `from OR to`, so pinning the caller's
    // branch here shows them both the transfers they are sending and the ones they are receiving.
    const transfers = await this.inventory.listTransfers(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { message: 'Transfers retrieved', data: { transfers } });
  });

  getTransfer = asyncHandler(async (req, res) => {
    const transfer = await this.inventory.getTransfer(req.params.id, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Transfer retrieved', data: { transfer } });
  });

  stockCount = asyncHandler(async (req, res) => {
    const data = await this.inventory.stockCount(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Stock count applied', data });
  });

  returnStock = asyncHandler(async (req, res) => {
    const data = await this.inventory.returnStock(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Stock returned', data });
  });

  consume = asyncHandler(async (req, res) => {
    const data = await this.inventory.consumeForTreatment({
      ...req.body,
      actorId: req.auth.userId,
      req,
      scopeBranchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Stock consumed', data });
  });

  ledger = asyncHandler(async (req, res) => {
    const result = await this.inventory.ledger(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, {
      message: 'Stock ledger',
      data: result.items,
      meta: result.meta,
    });
  });

  report = asyncHandler(async (req, res) => {
    const data = await this.inventory.reports(
      req.params.type,
      await scopedListQuery(req, { branch: true })
    );
    return ApiResponse.success(res, { data });
  });

  // Suppliers — organisation-wide by design (no branchId on the model); see the class docblock.
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
    const result = await this.purchase.listPos(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { data: result.items, meta: result.meta });
  });

  createPo = asyncHandler(async (req, res) => {
    const po = await this.purchase.createPo(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.created(res, { message: 'Purchase order created', data: { po } });
  });

  getPo = asyncHandler(async (req, res) => {
    const po = await this.purchase.getPo(req.params.id, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { data: { po } });
  });

  submitPo = asyncHandler(async (req, res) => {
    const po = await this.purchase.submitPo(req.params.id, req.auth.userId, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'PO submitted', data: { po } });
  });

  // GRN
  listGrns = asyncHandler(async (req, res) => {
    const result = await this.purchase.listGrns(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { data: result.items, meta: result.meta });
  });

  createGrn = asyncHandler(async (req, res) => {
    const grn = await this.purchase.createGrn(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.created(res, { message: 'GRN created', data: { grn } });
  });

  getGrn = asyncHandler(async (req, res) => {
    const grn = await this.purchase.getGrn(req.params.id, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { data: { grn } });
  });

  postGrn = asyncHandler(async (req, res) => {
    const grn = await this.purchase.postGrn(req.params.id, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Goods received', data: { grn } });
  });

  purchaseReport = asyncHandler(async (req, res) => {
    const data = await this.purchase.purchaseReport(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { data });
  });

  // Pharmacy
  pharmacyDashboard = asyncHandler(async (req, res) => {
    const query = await scopedListQuery(req, { branch: true });
    const data = await this.pharmacy.dashboard(query.branchId || null);
    return ApiResponse.success(res, { data });
  });

  prescriptionQueue = asyncHandler(async (req, res) => {
    const data = await this.pharmacy.prescriptionQueue(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { data });
  });

  listDispenses = asyncHandler(async (req, res) => {
    const result = await this.pharmacy.listDispenses(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { data: result.items, meta: result.meta });
  });

  startDispense = asyncHandler(async (req, res) => {
    const dispense = await this.pharmacy.startDispense(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.created(res, { message: 'Dispense started', data: { dispense } });
  });

  getDispense = asyncHandler(async (req, res) => {
    const dispense = await this.pharmacy.getDispense(req.params.id, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { data: { dispense } });
  });

  dispenseItems = asyncHandler(async (req, res) => {
    const dispense = await this.pharmacy.dispenseItems(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      { branchId: await this.#branchScope(req) }
    );
    return ApiResponse.success(res, { message: 'Medicines dispensed', data: { dispense } });
  });

  cancelDispense = asyncHandler(async (req, res) => {
    const dispense = await this.pharmacy.cancelDispense(req.params.id, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.success(res, { message: 'Dispense cancelled', data: { dispense } });
  });

  dispenseReport = asyncHandler(async (req, res) => {
    const data = await this.pharmacy.dispenseReport(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { data });
  });

  // Direct / retail sale (PHARM-DIRECT) — no prescription behind it.
  createDirectSale = asyncHandler(async (req, res) => {
    const sale = await this.pharmacy.createDirectSale(req.body, req.auth.userId, req, {
      branchId: await this.#branchScope(req),
    });
    return ApiResponse.created(res, { message: 'Sale recorded', data: { sale } });
  });

  listDirectSales = asyncHandler(async (req, res) => {
    const result = await this.pharmacy.listDirectSales(await scopedListQuery(req, { branch: true }));
    return ApiResponse.success(res, { data: result.items, meta: result.meta });
  });
}

export default InventoryController;
