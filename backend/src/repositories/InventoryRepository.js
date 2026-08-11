import BaseRepository from './BaseRepository.js';
import InventoryItem from '../models/InventoryItem.model.js';
import StockTransaction from '../models/StockTransaction.model.js';
import Supplier from '../models/Supplier.model.js';
import PurchaseOrder from '../models/PurchaseOrder.model.js';
import GoodsReceipt from '../models/GoodsReceipt.model.js';
import Dispense from '../models/Dispense.model.js';

export class InventoryItemRepository extends BaseRepository {
  constructor() {
    super(InventoryItem);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async findByMedicine(medicineId, branchId) {
    return this.model
      .findOne({ medicineId, branchId, deletedAt: null, isActive: true })
      .exec();
  }

  async list({
    branchId,
    itemType,
    q,
    lowStock,
    outOfStock,
    limit = 50,
    skip = 0,
  } = {}) {
    const filter = { deletedAt: null };
    if (branchId) filter.branchId = branchId;
    if (itemType) filter.itemType = itemType;
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { sku: new RegExp(q, 'i') },
        { itemCode: new RegExp(q, 'i') },
        { barcode: new RegExp(q, 'i') },
      ];
    }
    if (outOfStock) filter.currentStock = { $lte: 0 };
    if (lowStock) {
      filter.$expr = { $lte: ['$currentStock', '$reorderLevel'] };
      filter.currentStock = { ...(filter.currentStock || {}), $gt: 0 };
    }

    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ name: 1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

/**
 * INV-002 — stock transactions are an immutable ledger: append-only, no update/delete.
 * BaseRepository otherwise exposes generic updateById/deleteById; overriding both here to
 * throw turns "nothing calls them today" into "nothing CAN call them", closing the latent
 * gap where a future caller could inherit and use the generic mutators unnoticed.
 */
export class StockTransactionRepository extends BaseRepository {
  constructor() {
    super(StockTransaction);
  }

  async updateById() {
    throw new Error('StockTransaction is an immutable ledger — updates are not permitted. Create a new counter-entry instead.');
  }

  async deleteById() {
    throw new Error('StockTransaction is an immutable ledger — deletes are not permitted. Create a new counter-entry instead.');
  }

  async listLedger({ inventoryItemId, branchId, type, limit = 100, skip = 0 } = {}) {
    const filter = {};
    if (inventoryItemId) filter.inventoryItemId = inventoryItemId;
    if (branchId) filter.branchId = branchId;
    if (type) filter.type = type;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

export class SupplierRepository extends BaseRepository {
  constructor() {
    super(Supplier);
  }

  async findByIdNotDeleted(id) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }

  async list({ q, limit = 50, skip = 0 } = {}) {
    const filter = { deletedAt: null };
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { supplierCode: new RegExp(q, 'i') },
        { gstin: new RegExp(q, 'i') },
      ];
    }
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ name: 1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

export class PurchaseOrderRepository extends BaseRepository {
  constructor() {
    super(PurchaseOrder);
  }

  async findByIdNotDeleted(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('supplierId', 'name supplierCode gstin')
      .exec();
  }

  async list({ branchId, status, limit = 50, skip = 0 } = {}) {
    const filter = { deletedAt: null };
    if (branchId) filter.branchId = branchId;
    if (status) filter.status = status;
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('supplierId', 'name supplierCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

export class GoodsReceiptRepository extends BaseRepository {
  constructor() {
    super(GoodsReceipt);
  }

  async findByIdNotDeleted(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('supplierId', 'name supplierCode')
      .exec();
  }

  async list({ branchId, limit = 50, skip = 0 } = {}) {
    const filter = { deletedAt: null };
    if (branchId) filter.branchId = branchId;
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('supplierId', 'name supplierCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

export class DispenseRepository extends BaseRepository {
  constructor() {
    super(Dispense);
  }

  async findByIdPopulated(id) {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate('patientId', 'firstName lastName mrn mobile')
      .populate('pharmacistId', 'firstName lastName')
      .populate('prescriptionId', 'prescriptionNumber status items')
      .exec();
  }

  async findActiveByPrescription(prescriptionId) {
    return this.model
      .findOne({
        prescriptionId,
        deletedAt: null,
        status: { $in: ['PENDING', 'PARTIAL'] },
      })
      .exec();
  }

  async list({ branchId, status, patientId, saleType, limit = 50, skip = 0 } = {}) {
    const filter = { deletedAt: null };
    if (branchId) filter.branchId = branchId;
    if (status) filter.status = status;
    if (patientId) filter.patientId = patientId;
    if (saleType) filter.saleType = saleType;
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .populate('patientId', 'firstName lastName mrn')
        .populate('prescriptionId', 'prescriptionNumber status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }
}

export default {
  InventoryItemRepository,
  StockTransactionRepository,
  SupplierRepository,
  PurchaseOrderRepository,
  GoodsReceiptRepository,
  DispenseRepository,
};
