import mongoose from 'mongoose';
import { PO_STATUS, PO_STATUS_LIST } from '../enums/inventory.js';

const poItemSchema = new mongoose.Schema(
  {
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      default: null,
    },
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
    name: { type: String, required: true, trim: true },
    sku: { type: String, default: null },
    quantityOrdered: { type: Number, required: true, min: 1 },
    quantityReceived: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    mrp: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    items: { type: [poItemSchema], default: [] },
    status: {
      type: String,
      enum: PO_STATUS_LIST,
      default: PO_STATUS.DRAFT,
      index: true,
    },
    orderedAt: { type: Date, default: null },
    expectedDate: { type: Date, default: null },
    notes: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'purchase_orders',
  }
);

purchaseOrderSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    poNumber: this.poNumber,
    supplierId: this.supplierId?.toString?.() || this.supplierId,
    branchId: this.branchId?.toString?.() || this.branchId,
    items: (this.items || []).map((i) => ({
      id: i._id?.toString(),
      inventoryItemId: i.inventoryItemId?.toString?.() || null,
      medicineId: i.medicineId?.toString?.() || null,
      name: i.name,
      sku: i.sku,
      quantityOrdered: i.quantityOrdered,
      quantityReceived: i.quantityReceived,
      unitCost: i.unitCost,
      mrp: i.mrp,
    })),
    status: this.status,
    orderedAt: this.orderedAt,
    expectedDate: this.expectedDate,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const PurchaseOrder = mongoose.model('PurchaseOrder', purchaseOrderSchema);

export default PurchaseOrder;
