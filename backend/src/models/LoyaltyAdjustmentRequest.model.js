import mongoose from 'mongoose';
import {
  LOYALTY_ADJUSTMENT_STATUS_LIST,
  LOYALTY_ADJUSTMENT_STATUS,
  LOYALTY_MANUAL_REASON_CATEGORY_LIST,
} from '../enums/loyalty.js';

/**
 * LOY-008 — a manual adjustment above the requesting staff member's authority sits here,
 * PENDING_APPROVAL, until an owner/manager (LOYALTY_ADJUST_APPROVE) decides it. Only once
 * approved does LoyaltyLedgerService actually write the ledger entries — this document never
 * touches the ledger itself, it only records the request/decision trail (ledgerEntryIds is
 * filled in after approval for traceability).
 */
const loyaltyAdjustmentRequestSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    direction: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
    points: { type: Number, required: true, min: 1 },
    reasonCategory: { type: String, enum: LOYALTY_MANUAL_REASON_CATEGORY_LIST, required: true },
    note: { type: String, required: true, trim: true, maxlength: 1000 },

    status: { type: String, enum: LOYALTY_ADJUSTMENT_STATUS_LIST, default: LOYALTY_ADJUSTMENT_STATUS.PENDING_APPROVAL, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, default: null, trim: true, maxlength: 1000 },
    ledgerEntryIds: { type: [mongoose.Schema.Types.ObjectId], ref: 'LoyaltyLedgerEntry', default: [] },
  },
  { timestamps: true, collection: 'loyalty_adjustment_requests' }
);

loyaltyAdjustmentRequestSchema.index({ status: 1, createdAt: -1 });

loyaltyAdjustmentRequestSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    branchId: this.branchId?.toString?.() || this.branchId,
    patientId: this.patientId?.toString?.() || this.patientId,
    direction: this.direction,
    // Frontend adjustment-queue UI groups by ledger entryType vocabulary — surfaced here too
    // even though no ledger entry exists yet for PENDING_APPROVAL requests.
    entryType: this.direction === 'CREDIT' ? 'MANUAL_CREDIT' : 'MANUAL_DEBIT',
    points: this.points,
    reasonCategory: this.reasonCategory,
    note: this.note,
    status: this.status,
    requestedBy: this.requestedBy?.toString?.() || null,
    createdBy: this.requestedBy?.toString?.() || null,
    decidedBy: this.decidedBy?.toString?.() || null,
    decidedAt: this.decidedAt,
    decisionNote: this.decisionNote,
    ledgerEntryIds: (this.ledgerEntryIds || []).map((id) => id.toString()),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const LoyaltyAdjustmentRequest = mongoose.model('LoyaltyAdjustmentRequest', loyaltyAdjustmentRequestSchema);

export default LoyaltyAdjustmentRequest;
