import mongoose from 'mongoose';
import { CASH_SESSION_STATUS, CASH_SESSION_STATUS_LIST } from '../enums/billing.js';

/**
 * "Open cash for the day" — the start-of-day till open (BM/Cashier spec flow: Operations →
 * Cash → [Open cash] → {Opening float amount} → [Confirm] → cash session started).
 *
 * This is deliberately a separate, lightweight model from CashClose: CashClose is the
 * END-of-day reconciliation record (BIL-003) and previously accepted `openingCash` as a raw
 * free-form field at close time with no session concept behind it. One OPEN session per
 * branch per day (enforced by the unique index below); it is linked to the CashClose it
 * eventually produces via `cashCloseId`.
 */
const cashSessionSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    sessionDate: { type: Date, required: true, index: true },
    openingFloat: { type: Number, required: true, min: 0 },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    openedAt: { type: Date, default: () => new Date() },
    status: { type: String, enum: CASH_SESSION_STATUS_LIST, default: CASH_SESSION_STATUS.OPEN, index: true },
    closedAt: { type: Date, default: null },
    cashCloseId: { type: mongoose.Schema.Types.ObjectId, ref: 'CashClose', default: null },
  },
  { timestamps: true, collection: 'cash_sessions' }
);

// One session per branch per day — a second "Open cash" for an already-open day is rejected
// at the service layer, but this index is the backstop against a race.
cashSessionSchema.index({ branchId: 1, sessionDate: 1 }, { unique: true });

cashSessionSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    branchId: this.branchId.toString(),
    sessionDate: this.sessionDate,
    openingFloat: this.openingFloat,
    openedBy: this.openedBy.toString(),
    openedAt: this.openedAt,
    status: this.status,
    closedAt: this.closedAt,
    cashCloseId: this.cashCloseId ? this.cashCloseId.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const CashSession = mongoose.model('CashSession', cashSessionSchema);

export default CashSession;
