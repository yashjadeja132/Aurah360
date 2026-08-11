import mongoose from 'mongoose';
import {
  ADJUSTMENT_REASON_CATEGORY_LIST,
  ADJUSTMENT_REQUEST_STATUS_LIST,
} from '../enums/inventory.js';

/**
 * Stock adjustment approval workflow (INV-003) — mirrors StockTransferRequest's
 * request → decide state machine. Created only for "unusual" adjustments (see
 * `InventoryService#isUnusualAdjustment` / config.inventory.adjustmentApprovalThreshold*);
 * routine adjustments never create one of these — they still write straight to stock via
 * `InventoryService.adjust()`, unchanged.
 *
 * The immutable stock ledger entry (StockTransaction, via `#applyMovement`) is written only
 * once this request is APPROVED — stock is untouched while PENDING_APPROVAL.
 */
const stockAdjustmentRequestSchema = new mongoose.Schema(
  {
    adjustmentNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    inventoryItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    batchNumber: { type: String, default: null },
    quantityDelta: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    reasonCategory: { type: String, enum: ADJUSTMENT_REASON_CATEGORY_LIST, default: 'OTHER' },
    notes: { type: String, default: null },
    status: { type: String, enum: ADJUSTMENT_REQUEST_STATUS_LIST, default: 'PENDING_APPROVAL', index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, default: null },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction', default: null },
  },
  { timestamps: true, collection: 'stock_adjustment_requests' }
);

stockAdjustmentRequestSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    adjustmentNumber: this.adjustmentNumber,
    inventoryItemId: this.inventoryItemId.toString(),
    branchId: this.branchId.toString(),
    batchNumber: this.batchNumber,
    quantityDelta: this.quantityDelta,
    reason: this.reason,
    reasonCategory: this.reasonCategory,
    notes: this.notes,
    status: this.status,
    requestedBy: this.requestedBy.toString(),
    decidedBy: this.decidedBy ? this.decidedBy.toString() : null,
    decidedAt: this.decidedAt,
    decisionNote: this.decisionNote,
    transactionId: this.transactionId ? this.transactionId.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const StockAdjustmentRequest = mongoose.model('StockAdjustmentRequest', stockAdjustmentRequestSchema);

export default StockAdjustmentRequest;
