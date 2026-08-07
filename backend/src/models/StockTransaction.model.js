import mongoose from 'mongoose';
import { STOCK_TX_TYPE_LIST } from '../enums/inventory.js';

/**
 * Immutable stock ledger. Never update or delete after create.
 */
const stockTransactionSchema = new mongoose.Schema(
  {
    transactionNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: STOCK_TX_TYPE_LIST,
      required: true,
      index: true,
    },
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    batchNumber: { type: String, default: null, trim: true },
    quantity: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, default: null, min: 0 },
    referenceType: { type: String, default: null, trim: true, index: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    reason: { type: String, default: null, trim: true },
    notes: { type: String, default: null, trim: true },
    transferToBranchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    transferToItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'stock_transactions',
  }
);

stockTransactionSchema.index({ createdAt: -1 });
stockTransactionSchema.index({ inventoryItemId: 1, createdAt: -1 });

stockTransactionSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    transactionNumber: this.transactionNumber,
    type: this.type,
    inventoryItemId: this.inventoryItemId?.toString?.() || this.inventoryItemId,
    branchId: this.branchId?.toString?.() || this.branchId,
    batchNumber: this.batchNumber,
    quantity: this.quantity,
    balanceAfter: this.balanceAfter,
    unitCost: this.unitCost,
    referenceType: this.referenceType,
    referenceId: this.referenceId?.toString?.() || this.referenceId || null,
    reason: this.reason,
    notes: this.notes,
    transferToBranchId: this.transferToBranchId?.toString?.() || null,
    transferToItemId: this.transferToItemId?.toString?.() || null,
    createdBy: this.createdBy?.toString?.() || null,
    createdAt: this.createdAt,
    ...extra,
  };
};

const StockTransaction = mongoose.model('StockTransaction', stockTransactionSchema);

export default StockTransaction;
