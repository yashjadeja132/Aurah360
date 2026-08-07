import mongoose from 'mongoose';
import { CREDIT_NOTE_STATUS, CREDIT_NOTE_STATUS_LIST } from '../enums/billing.js';

/** Credit note issued from a refund — usable against a future invoice (BIL-002). */
const creditNoteSchema = new mongoose.Schema(
  {
    creditNoteNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    sourcePaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    sourceInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    amount: { type: Number, required: true, min: 0 },
    balance: { type: Number, required: true, min: 0 },
    status: { type: String, enum: CREDIT_NOTE_STATUS_LIST, default: CREDIT_NOTE_STATUS.ISSUED, index: true },
    reason: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    appliedTo: {
      type: [{ invoiceId: mongoose.Schema.Types.ObjectId, amount: Number, appliedAt: Date }],
      default: [],
    },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, collection: 'credit_notes' }
);

creditNoteSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    creditNoteNumber: this.creditNoteNumber,
    patientId: this.patientId.toString(),
    branchId: this.branchId.toString(),
    sourcePaymentId: this.sourcePaymentId ? this.sourcePaymentId.toString() : null,
    sourceInvoiceId: this.sourceInvoiceId ? this.sourceInvoiceId.toString() : null,
    amount: this.amount,
    balance: this.balance,
    status: this.status,
    reason: this.reason,
    expiresAt: this.expiresAt,
    appliedTo: this.appliedTo,
    issuedBy: this.issuedBy.toString(),
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const CreditNote = mongoose.model('CreditNote', creditNoteSchema);

export default CreditNote;
