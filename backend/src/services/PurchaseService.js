import ApiError from '../libs/ApiError.js';
import {
  SupplierRepository,
  PurchaseOrderRepository,
  GoodsReceiptRepository,
} from '../repositories/InventoryRepository.js';
import InventoryService from './InventoryService.js';
import AuditService from './AuditService.js';
import { eventBus } from '../events/eventBus.js';
import {
  generateSupplierCode,
  generatePoNumber,
  generateGrnNumber,
} from '../helpers/inventoryNumber.helper.js';
import { GR_STATUS, INVENTORY_EVENTS, PO_STATUS } from '../enums/inventory.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';

class PurchaseService {
  constructor() {
    this.supplierRepo = new SupplierRepository();
    this.poRepo = new PurchaseOrderRepository();
    this.grRepo = new GoodsReceiptRepository();
    this.inventoryService = new InventoryService();
    this.auditService = new AuditService();
  }

  /**
   * SEC-030 — single-record branch gate for the purchase documents that DO carry a branch
   * (PurchaseOrder, GoodsReceipt). Out of scope reads as "not found", never 403.
   *
   * Suppliers deliberately have NO branch gate: the Supplier model has no `branchId` at all — it
   * is one organisation-wide vendor master that every branch orders against — so there is nothing
   * to scope on and inventing one would only fragment the catalogue.
   */
  #assertBranchScope(doc, branchId, notFoundMessage) {
    if (!branchId || !doc) return doc;
    if (String(doc.branchId) !== String(branchId)) {
      throw ApiError.notFound(notFoundMessage);
    }
    return doc;
  }

  #assertWriteBranch(payloadBranchId, branchId) {
    if (branchId && String(payloadBranchId) !== String(branchId)) {
      throw ApiError.forbidden('branchId is outside your branch scope', 'BRANCH_SCOPE_VIOLATION');
    }
  }

  // —— Suppliers ——
  async createSupplier(payload, actorId) {
    if (!payload.name) throw ApiError.badRequest('name is required');
    const doc = await this.supplierRepo.create({
      supplierCode: await generateSupplierCode(),
      name: payload.name,
      gstin: payload.gstin || null,
      contactName: payload.contactName || null,
      phone: payload.phone || null,
      email: payload.email || null,
      address: payload.address || {},
      paymentTerms: payload.paymentTerms || 'Net 30',
      notes: payload.notes || null,
      createdBy: actorId,
      updatedBy: actorId,
    });
    return doc.toSafeObject();
  }

  async updateSupplier(id, payload, actorId) {
    const doc = await this.supplierRepo.findByIdNotDeleted(id);
    if (!doc) throw ApiError.notFound('Supplier not found');
    const updates = { updatedBy: actorId };
    for (const f of [
      'name',
      'gstin',
      'contactName',
      'phone',
      'email',
      'paymentTerms',
      'notes',
      'isActive',
    ]) {
      if (payload[f] !== undefined) updates[f] = payload[f];
    }
    if (payload.address) updates.address = { ...doc.address?.toObject?.(), ...payload.address };
    await this.supplierRepo.updateById(id, updates);
    return (await this.supplierRepo.findByIdNotDeleted(id)).toSafeObject();
  }

  async getSupplier(id) {
    const doc = await this.supplierRepo.findByIdNotDeleted(id);
    if (!doc) throw ApiError.notFound('Supplier not found');
    return doc.toSafeObject();
  }

  async listSuppliers(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const { items, total } = await this.supplierRepo.list({
      q: query.q || null,
      limit,
      skip: (page - 1) * limit,
    });
    return {
      items: items.map((s) => s.toSafeObject()),
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async softDeleteSupplier(id, actorId) {
    const doc = await this.supplierRepo.findByIdNotDeleted(id);
    if (!doc) throw ApiError.notFound('Supplier not found');
    await this.supplierRepo.updateById(id, {
      deletedAt: new Date(),
      deletedBy: actorId,
      isActive: false,
    });
    return { id };
  }

  // —— Purchase Orders ——
  #mapPo(doc) {
    if (!doc) return null;
    const extra = {};
    if (doc.supplierId?.name) {
      extra.supplier = {
        id: doc.supplierId._id.toString(),
        name: doc.supplierId.name,
        supplierCode: doc.supplierId.supplierCode,
        gstin: doc.supplierId.gstin,
      };
      extra.supplierId = doc.supplierId._id.toString();
    }
    return doc.toSafeObject(extra);
  }

  async createPo(payload, actorId, req = null, { branchId = null } = {}) {
    if (!payload.supplierId) throw ApiError.badRequest('supplierId is required');
    if (!payload.branchId) throw ApiError.badRequest('branchId is required');
    this.#assertWriteBranch(payload.branchId, branchId);
    const supplier = await this.supplierRepo.findByIdNotDeleted(payload.supplierId);
    if (!supplier) throw ApiError.notFound('Supplier not found');
    if (!Array.isArray(payload.items) || !payload.items.length) {
      throw ApiError.badRequest('items are required');
    }

    const items = payload.items.map((i) => ({
      inventoryItemId: i.inventoryItemId || null,
      medicineId: i.medicineId || null,
      name: i.name,
      sku: i.sku || null,
      quantityOrdered: Number(i.quantityOrdered || i.quantity || 1),
      quantityReceived: 0,
      unitCost: Number(i.unitCost || 0),
      mrp: Number(i.mrp || 0),
    }));

    const doc = await this.poRepo.create({
      poNumber: await generatePoNumber(),
      supplierId: payload.supplierId,
      branchId: payload.branchId,
      items,
      status: PO_STATUS.DRAFT,
      expectedDate: payload.expectedDate ? new Date(payload.expectedDate) : null,
      notes: payload.notes || null,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.PURCHASE_CREATED, {
      actorId,
      metadata: { poId: doc._id.toString(), poNumber: doc.poNumber },
      req,
    });

    return this.getPo(doc._id.toString());
  }

  async getPo(id, { branchId = null } = {}) {
    const doc = await this.poRepo.findByIdNotDeleted(id);
    if (!doc) throw ApiError.notFound('Purchase order not found');
    this.#assertBranchScope(doc, branchId, 'Purchase order not found');
    return this.#mapPo(doc);
  }

  async listPos(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const { items, total } = await this.poRepo.list({
      branchId: query.branchId || null,
      status: query.status || null,
      limit,
      skip: (page - 1) * limit,
    });
    return {
      items: items.map((p) => this.#mapPo(p)),
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  async submitPo(id, actorId, { branchId = null } = {}) {
    const doc = await this.poRepo.findByIdNotDeleted(id);
    if (!doc) throw ApiError.notFound('Purchase order not found');
    this.#assertBranchScope(doc, branchId, 'Purchase order not found');
    if (doc.status !== PO_STATUS.DRAFT) {
      throw ApiError.badRequest('Only draft POs can be submitted');
    }
    await this.poRepo.updateById(id, {
      status: PO_STATUS.ORDERED,
      orderedAt: new Date(),
      updatedBy: actorId,
    });
    return this.getPo(id);
  }

  // —— Goods Receipt ——
  async createGrn(payload, actorId, req = null, { branchId = null } = {}) {
    if (!payload.supplierId) throw ApiError.badRequest('supplierId is required');
    if (!payload.branchId) throw ApiError.badRequest('branchId is required');
    this.#assertWriteBranch(payload.branchId, branchId);
    if (!Array.isArray(payload.items) || !payload.items.length) {
      throw ApiError.badRequest('items are required');
    }

    const items = payload.items.map((i) => {
      if (!i.inventoryItemId) throw ApiError.badRequest('inventoryItemId required on GRN items');
      if (!i.batchNumber) throw ApiError.badRequest('batchNumber required on GRN items');
      if (!i.expiryDate) throw ApiError.badRequest('expiryDate required on GRN items');
      return {
        inventoryItemId: i.inventoryItemId,
        purchaseOrderItemId: i.purchaseOrderItemId || null,
        name: i.name,
        batchNumber: i.batchNumber,
        expiryDate: new Date(i.expiryDate),
        quantity: Number(i.quantity),
        unitCost: Number(i.unitCost || 0),
        mrp: Number(i.mrp || 0),
      };
    });

    const doc = await this.grRepo.create({
      grnNumber: await generateGrnNumber(),
      purchaseOrderId: payload.purchaseOrderId || null,
      supplierId: payload.supplierId,
      branchId: payload.branchId,
      items,
      status: GR_STATUS.DRAFT,
      notes: payload.notes || null,
      createdBy: actorId,
      updatedBy: actorId,
    });

    return this.getGrn(doc._id.toString());
  }

  async getGrn(id, { branchId = null } = {}) {
    const doc = await this.grRepo.findByIdNotDeleted(id);
    if (!doc) throw ApiError.notFound('Goods receipt not found');
    this.#assertBranchScope(doc, branchId, 'Goods receipt not found');
    const extra = {};
    if (doc.supplierId?.name) {
      extra.supplier = {
        id: doc.supplierId._id.toString(),
        name: doc.supplierId.name,
        supplierCode: doc.supplierId.supplierCode,
      };
      extra.supplierId = doc.supplierId._id.toString();
    }
    return doc.toSafeObject(extra);
  }

  async listGrns(query = {}) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const { items, total } = await this.grRepo.list({
      branchId: query.branchId || null,
      limit,
      skip: (page - 1) * limit,
    });
    return {
      items: items.map((g) => {
        const extra = {};
        if (g.supplierId?.name) {
          extra.supplier = {
            id: g.supplierId._id.toString(),
            name: g.supplierId.name,
            supplierCode: g.supplierId.supplierCode,
          };
          extra.supplierId = g.supplierId._id.toString();
        }
        return g.toSafeObject(extra);
      }),
      meta: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    };
  }

  /** Post GRN — receives stock via InventoryService (only stock path). */
  async postGrn(id, actorId, req = null, { branchId = null } = {}) {
    const grn = await this.grRepo.findByIdNotDeleted(id);
    if (!grn) throw ApiError.notFound('Goods receipt not found');
    this.#assertBranchScope(grn, branchId, 'Goods receipt not found');
    if (grn.status === GR_STATUS.POSTED) {
      throw ApiError.forbidden('Goods receipt already posted');
    }

    for (const line of grn.items || []) {
      await this.inventoryService.receivePurchase({
        inventoryItemId: line.inventoryItemId,
        quantity: line.quantity,
        batchNumber: line.batchNumber,
        expiryDate: line.expiryDate,
        unitCost: line.unitCost,
        mrp: line.mrp,
        referenceId: grn._id,
        notes: `GRN ${grn.grnNumber}`,
        actorId,
        req,
      });
    }

    if (grn.purchaseOrderId) {
      const po = await this.poRepo.findByIdNotDeleted(grn.purchaseOrderId);
      if (po) {
        const items = (po.items || []).map((i) => i.toObject?.() || { ...i });
        for (const line of grn.items || []) {
          const match = items.find(
            (i) =>
              (line.purchaseOrderItemId && String(i._id) === String(line.purchaseOrderItemId)) ||
              (i.inventoryItemId && String(i.inventoryItemId) === String(line.inventoryItemId)) ||
              i.name === line.name
          );
          if (match) {
            match.quantityReceived = (match.quantityReceived || 0) + line.quantity;
          }
        }
        const allReceived = items.every(
          (i) => (i.quantityReceived || 0) >= (i.quantityOrdered || 0)
        );
        const anyReceived = items.some((i) => (i.quantityReceived || 0) > 0);
        await this.poRepo.updateById(po._id, {
          items,
          status: allReceived
            ? PO_STATUS.RECEIVED
            : anyReceived
              ? PO_STATUS.PARTIAL_RECEIVED
              : po.status,
          updatedBy: actorId,
        });
      }
    }

    await this.grRepo.updateById(id, {
      status: GR_STATUS.POSTED,
      receivedAt: new Date(),
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.GOODS_RECEIVED, {
      actorId,
      metadata: { grnId: id, grnNumber: grn.grnNumber },
      req,
    });

    eventBus.emitDomain(INVENTORY_EVENTS.GOODS_RECEIVED, {
      grnId: id,
      grnNumber: grn.grnNumber,
      branchId: grn.branchId.toString(),
    });

    return this.getGrn(id);
  }

  async purchaseReport(query = {}) {
    return this.listPos(query);
  }
}

export default PurchaseService;
