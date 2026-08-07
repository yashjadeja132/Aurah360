import mongoose from 'mongoose';
import {
  LOYALTY_ENTRY_TYPE_LIST,
  LOYALTY_SOURCE_REF_TYPE_LIST,
  LOYALTY_MANUAL_REASON_CATEGORY_LIST,
} from '../enums/loyalty.js';

/**
 * LOY-003 — append-only points ledger. Never update or delete after create (same immutable
 * pattern as StockTransaction.model.js) — the current/redeemable balance is always DERIVED by
 * summing entries (LoyaltyBalanceCache is a rebuildable read-optimization, never the source of
 * truth). A mistaken entry is corrected with a counter-entry, never edited in place.
 */
const loyaltyLedgerEntrySchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },

    entryType: { type: String, enum: LOYALTY_ENTRY_TYPE_LIST, required: true, index: true },
    /** Always a positive integer — the sign/effect is derived from entryType, never stored as
     *  a signed number, so a bug can't silently flip a credit into a debit or vice versa. */
    points: { type: Number, required: true, min: 1 },

    ruleCode: { type: String, default: null, index: true },
    ruleVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoyaltyEarningRuleVersion', default: null },

    sourceRefType: { type: String, enum: LOYALTY_SOURCE_REF_TYPE_LIST, default: null },
    sourceRefId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

    /** CREDIT entries only — FIFO expiry lot; null means "never expires" for that lot. */
    earnLotExpiryDate: { type: Date, default: null, index: true },
    /** DEBIT_EXPIRY/DEBIT_REDEEM/DEBIT_CLAWBACK — which CREDIT entry this consumed from,
     *  so FIFO consumption and reversal-restoration can trace back to the original lot. */
    consumesEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoyaltyLedgerEntry', default: null },

    /** Redemption entries only. */
    redeemedValueInr: { type: Number, default: null, min: 0 },
    conversionRateVersion: { type: mongoose.Schema.Types.ObjectId, ref: 'LoyaltyProgramSettings', default: null },

    /** Manual entries only (LOY-008). */
    reasonCategory: { type: String, enum: LOYALTY_MANUAL_REASON_CATEGORY_LIST, default: null },
    note: { type: String, default: null, trim: true, maxlength: 1000 },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    /** Duplicate-delivery guard (job/webhook retries) — unique per (patientId, idempotencyKey). */
    idempotencyKey: { type: String, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'loyalty_ledger_entries',
  }
);

loyaltyLedgerEntrySchema.index({ patientId: 1, createdAt: -1 });
loyaltyLedgerEntrySchema.index({ patientId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });
loyaltyLedgerEntrySchema.index({ entryType: 1, earnLotExpiryDate: 1 });

loyaltyLedgerEntrySchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    branchId: this.branchId?.toString?.() || this.branchId,
    patientId: this.patientId?.toString?.() || this.patientId,
    entryType: this.entryType,
    points: this.points,
    ruleCode: this.ruleCode,
    ruleVersionId: this.ruleVersionId?.toString?.() || null,
    sourceRefType: this.sourceRefType,
    sourceRefId: this.sourceRefId?.toString?.() || null,
    earnLotExpiryDate: this.earnLotExpiryDate,
    consumesEntryId: this.consumesEntryId?.toString?.() || null,
    redeemedValueInr: this.redeemedValueInr,
    reasonCategory: this.reasonCategory,
    note: this.note,
    approvedBy: this.approvedBy?.toString?.() || null,
    createdBy: this.createdBy?.toString?.() || null,
    createdAt: this.createdAt,
    ...extra,
  };
};

const LoyaltyLedgerEntry = mongoose.model('LoyaltyLedgerEntry', loyaltyLedgerEntrySchema);

export default LoyaltyLedgerEntry;
