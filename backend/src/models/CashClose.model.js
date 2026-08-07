import mongoose from 'mongoose';
import { CASH_CLOSE_STATUS, CASH_CLOSE_STATUS_LIST } from '../enums/billing.js';

/** Daily branch cash close — opening, collection, refund, expected vs counted, variance (BIL-003). */
const cashCloseSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    closeDate: { type: Date, required: true, index: true },
    openingCash: { type: Number, required: true, min: 0 },
    cashCollected: { type: Number, required: true, min: 0 },
    cashRefunded: { type: Number, default: 0, min: 0 },
    otherModeCollected: { type: Number, default: 0, min: 0 },
    expectedCash: { type: Number, required: true },
    countedCash: { type: Number, required: true, min: 0 },
    variance: { type: Number, required: true },
    varianceReason: { type: String, default: null },
    status: { type: String, enum: CASH_CLOSE_STATUS_LIST, default: CASH_CLOSE_STATUS.SUBMITTED, index: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    notes: { type: String, default: null },
  },
  { timestamps: true, collection: 'cash_closes' }
);

cashCloseSchema.index({ branchId: 1, closeDate: 1 }, { unique: true });

cashCloseSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    branchId: this.branchId.toString(),
    closeDate: this.closeDate,
    openingCash: this.openingCash,
    cashCollected: this.cashCollected,
    cashRefunded: this.cashRefunded,
    otherModeCollected: this.otherModeCollected,
    expectedCash: this.expectedCash,
    countedCash: this.countedCash,
    variance: this.variance,
    varianceReason: this.varianceReason,
    status: this.status,
    submittedBy: this.submittedBy.toString(),
    approvedBy: this.approvedBy ? this.approvedBy.toString() : null,
    approvedAt: this.approvedAt,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const CashClose = mongoose.model('CashClose', cashCloseSchema);

export default CashClose;
