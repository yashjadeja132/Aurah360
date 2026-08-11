import mongoose from 'mongoose';
import { GR_STATUS, GR_STATUS_LIST } from '../enums/inventory.js';

const grItemSchema = new mongoose.Schema(
  {
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
    },
    purchaseOrderItemId: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    batchNumber: { type: String, required: true, trim: true },
    // GRN-GAP-4 — optional, not every product carries a printed manufacture date.
    manufactureDate: { type: Date, default: null },
    expiryDate: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, default: 0, min: 0 },
    mrp: { type: Number, default: 0, min: 0 },
    // GRN-GAP-4 — optional per-line bin/shelf location within the branch storeroom.
    bin: { type: String, default: null, trim: true },
  },
  { _id: true }
);

const goodsReceiptSchema = new mongoose.Schema(
  {
    grnNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      default: null,
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
    items: { type: [grItemSchema], default: [] },
    status: {
      type: String,
      enum: GR_STATUS_LIST,
      default: GR_STATUS.DRAFT,
      index: true,
    },
    receivedAt: { type: Date, default: null },
    notes: { type: String, default: null },
    // GRN-GAP-4 — header-level tax/landed cost/payment reference, per spec.
    tax: { type: Number, default: 0, min: 0 },
    landedCost: { type: Number, default: 0, min: 0 },
    paymentReference: { type: String, default: null, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'goods_receipts',
  }
);

goodsReceiptSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    grnNumber: this.grnNumber,
    purchaseOrderId: this.purchaseOrderId?.toString?.() || null,
    supplierId: this.supplierId?.toString?.() || this.supplierId,
    branchId: this.branchId?.toString?.() || this.branchId,
    items: (this.items || []).map((i) => ({
      id: i._id?.toString(),
      inventoryItemId: i.inventoryItemId?.toString?.() || i.inventoryItemId,
      purchaseOrderItemId: i.purchaseOrderItemId?.toString?.() || null,
      name: i.name,
      batchNumber: i.batchNumber,
      manufactureDate: i.manufactureDate,
      expiryDate: i.expiryDate,
      quantity: i.quantity,
      unitCost: i.unitCost,
      mrp: i.mrp,
      bin: i.bin,
    })),
    status: this.status,
    receivedAt: this.receivedAt,
    notes: this.notes,
    tax: this.tax,
    landedCost: this.landedCost,
    paymentReference: this.paymentReference,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const GoodsReceipt = mongoose.model('GoodsReceipt', goodsReceiptSchema);

export default GoodsReceipt;
