import mongoose from 'mongoose';
import {
  PAYMENT_METHOD_LIST,
  PAYMENT_RECORD_STATUS,
  PAYMENT_RECORD_STATUS_LIST,
} from '../enums/billing.js';

const paymentSplitSchema = new mongoose.Schema(
  {
    method: { type: String, enum: PAYMENT_METHOD_LIST, required: true },
    amount: { type: Number, required: true, min: 0 },
    reference: { type: String, default: null },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    method: {
      type: String,
      enum: PAYMENT_METHOD_LIST,
      required: true,
      index: true,
    },
    splits: { type: [paymentSplitSchema], default: [] },
    isAdvance: { type: Boolean, default: false },
    isPartial: { type: Boolean, default: false },
    reference: { type: String, default: null },
    notes: { type: String, default: null },
    status: {
      type: String,
      enum: PAYMENT_RECORD_STATUS_LIST,
      default: PAYMENT_RECORD_STATUS.RECORDED,
      index: true,
    },
    /** Deprecated RC1 field — real refund fields below replace it (BIL-002). */
    refundPlaceholder: { type: Boolean, default: false },
    refundedAmount: { type: Number, default: 0, min: 0 },
    refundedAt: { type: Date, default: null },
    refundNotes: { type: String, default: null },
    refundMethod: { type: String, enum: ['ORIGINAL_MODE', 'CASH', 'CREDIT_NOTE', null], default: null },
    refundReason: { type: String, default: null },
    refundApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    creditNoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditNote', default: null },
    paidAt: { type: Date, default: Date.now },
    printedAt: { type: Date, default: null },
    printCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'payments',
  }
);

paymentSchema.index({ invoiceId: 1, createdAt: -1 });

paymentSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    paymentNumber: this.paymentNumber,
    receiptNumber: this.receiptNumber,
    invoiceId: this.invoiceId.toString(),
    patientId: this.patientId.toString(),
    branchId: this.branchId.toString(),
    amount: this.amount,
    method: this.method,
    splits: this.splits || [],
    isAdvance: this.isAdvance,
    isPartial: this.isPartial,
    reference: this.reference,
    notes: this.notes,
    status: this.status,
    refundPlaceholder: this.refundPlaceholder,
    refundedAmount: this.refundedAmount,
    refundedAt: this.refundedAt,
    refundNotes: this.refundNotes,
    refundMethod: this.refundMethod,
    refundReason: this.refundReason,
    refundApprovedBy: this.refundApprovedBy ? this.refundApprovedBy.toString() : null,
    creditNoteId: this.creditNoteId ? this.creditNoteId.toString() : null,
    paidAt: this.paidAt,
    printedAt: this.printedAt,
    printCount: this.printCount,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
