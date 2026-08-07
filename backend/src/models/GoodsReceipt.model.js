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
    expiryDate: { type: Date, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, default: 0, min: 0 },
    mrp: { type: Number, default: 0, min: 0 },
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
      expiryDate: i.expiryDate,
      quantity: i.quantity,
      unitCost: i.unitCost,
      mrp: i.mrp,
    })),
    status: this.status,
    receivedAt: this.receivedAt,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const GoodsReceipt = mongoose.model('GoodsReceipt', goodsReceiptSchema);

export default GoodsReceipt;
