import mongoose from 'mongoose';

const TRANSFER_STATUS = [
  'REQUESTED',
  'APPROVED',
  'DISPATCHED',
  'IN_TRANSIT',
  'RECEIVED',
  'REJECTED',
  'CANCELLED',
];

/**
 * Branch stock transfer workflow — request → approve → dispatch → in transit → receive,
 * with both branches reconciling (INV-002, §11.2). The immutable movement ledger is written
 * by InventoryService at dispatch/receive; this document tracks the approval state machine.
 */
const stockTransferRequestSchema = new mongoose.Schema(
  {
    transferNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    fromBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    toBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    fromItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
    toItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', default: null },
    batchNumber: { type: String, default: null },
    quantityRequested: { type: Number, required: true, min: 0.01 },
    quantityDispatched: { type: Number, default: null },
    quantityReceived: { type: Number, default: null },
    varianceQuantity: { type: Number, default: null },
    varianceNotes: { type: String, default: null },
    status: { type: String, enum: TRANSFER_STATUS, default: 'REQUESTED', index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    dispatchedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dispatchedAt: { type: Date, default: null },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    receivedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    outTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction', default: null },
    inTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction', default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true, collection: 'stock_transfer_requests' }
);

stockTransferRequestSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    transferNumber: this.transferNumber,
    fromBranchId: this.fromBranchId.toString(),
    toBranchId: this.toBranchId.toString(),
    fromItemId: this.fromItemId.toString(),
    toItemId: this.toItemId ? this.toItemId.toString() : null,
    batchNumber: this.batchNumber,
    quantityRequested: this.quantityRequested,
    quantityDispatched: this.quantityDispatched,
    quantityReceived: this.quantityReceived,
    varianceQuantity: this.varianceQuantity,
    varianceNotes: this.varianceNotes,
    status: this.status,
    requestedBy: this.requestedBy.toString(),
    approvedBy: this.approvedBy ? this.approvedBy.toString() : null,
    approvedAt: this.approvedAt,
    dispatchedBy: this.dispatchedBy ? this.dispatchedBy.toString() : null,
    dispatchedAt: this.dispatchedAt,
    receivedBy: this.receivedBy ? this.receivedBy.toString() : null,
    receivedAt: this.receivedAt,
    rejectionReason: this.rejectionReason,
    outTransactionId: this.outTransactionId ? this.outTransactionId.toString() : null,
    inTransactionId: this.inTransactionId ? this.inTransactionId.toString() : null,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const TRANSFER_STATUS_LIST = TRANSFER_STATUS;
const StockTransferRequest = mongoose.model('StockTransferRequest', stockTransferRequestSchema);
export default StockTransferRequest;
