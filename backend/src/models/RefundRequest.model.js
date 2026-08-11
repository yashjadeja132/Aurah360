import mongoose from 'mongoose';
import {
  REFUND_APPROVAL_STATUS_LIST,
  REFUND_APPROVAL_STATUS,
  REFUND_METHOD_LIST,
  REFUND_REASON_LIST,
} from '../enums/billing.js';

/**
 * A.8 — a refund above config.billing.refundApprovalThresholdAmount sits here PENDING_APPROVAL
 * until an approver (BILLING_REFUND_APPROVE) decides. Mirrors LoyaltyAdjustmentRequest: this
 * document never moves money itself — only once approved does BillingController call
 * BillingService#refund (the real, money-moving method), and paymentId/creditNote results are
 * recorded back onto this request for traceability.
 */
const refundRequestSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: REFUND_METHOD_LIST, default: 'ORIGINAL_MODE' },
    reason: { type: String, enum: REFUND_REASON_LIST, required: true },
    notes: { type: String, default: null, trim: true, maxlength: 1000 },
    creditNoteExpiresAt: { type: Date, default: null },

    status: {
      type: String,
      enum: REFUND_APPROVAL_STATUS_LIST,
      default: REFUND_APPROVAL_STATUS.PENDING_APPROVAL,
      index: true,
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, default: null, trim: true, maxlength: 1000 },
    resultPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    resultCreditNoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditNote', default: null },
  },
  { timestamps: true, collection: 'refund_requests' }
);

refundRequestSchema.index({ status: 1, createdAt: -1 });

refundRequestSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    branchId: this.branchId?.toString?.() || this.branchId,
    invoiceId: this.invoiceId?.toString?.() || this.invoiceId,
    paymentId: this.paymentId?.toString?.() || this.paymentId,
    patientId: this.patientId?.toString?.() || null,
    amount: this.amount,
    method: this.method,
    reason: this.reason,
    notes: this.notes,
    creditNoteExpiresAt: this.creditNoteExpiresAt,
    status: this.status,
    requestedBy: this.requestedBy?.toString?.() || null,
    decidedBy: this.decidedBy?.toString?.() || null,
    decidedAt: this.decidedAt,
    decisionNote: this.decisionNote,
    resultPaymentId: this.resultPaymentId?.toString?.() || null,
    resultCreditNoteId: this.resultCreditNoteId?.toString?.() || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const RefundRequest = mongoose.model('RefundRequest', refundRequestSchema);

export default RefundRequest;
