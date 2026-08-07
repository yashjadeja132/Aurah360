import mongoose from 'mongoose';
import {
  DISCOUNT_TYPE,
  DISCOUNT_TYPE_LIST,
  INVOICE_ITEM_TYPE_LIST,
  INVOICE_STATUS,
  INVOICE_STATUS_LIST,
  PAYMENT_STATUS,
  PAYMENT_STATUS_LIST,
} from '../enums/billing.js';

const invoiceItemSchema = new mongoose.Schema(
  {
    itemType: {
      type: String,
      enum: INVOICE_ITEM_TYPE_LIST,
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 1, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: true }
);

const packageSnapshotSchema = new mongoose.Schema(
  {
    packageId: { type: mongoose.Schema.Types.ObjectId, default: null },
    packageName: { type: String, default: null },
    packagePrice: { type: Number, default: null },
    discount: { type: Number, default: 0 },
    validityDays: { type: Number, default: null },
    maximumSessions: { type: Number, default: null },
    unusedSessions: { type: Number, default: null },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    invoiceDate: { type: Date, default: Date.now, index: true },
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
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
      index: true,
    },
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
      default: null,
      index: true,
    },
    treatmentPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TreatmentPlan',
      default: null,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: INVOICE_STATUS_LIST,
      default: INVOICE_STATUS.DRAFT,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUS_LIST,
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    items: { type: [invoiceItemSchema], default: [] },
    packageSnapshot: { type: packageSnapshotSchema, default: null },
    subtotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    discountType: {
      type: String,
      enum: [...DISCOUNT_TYPE_LIST, null],
      default: DISCOUNT_TYPE.FLAT,
    },
    discountValue: { type: Number, default: 0, min: 0 },
    discountApprovalRequired: { type: Boolean, default: false },
    discountApproved: { type: Boolean, default: false },
    /** LOY-005 — loyalty-points redemption applied as a discount at billing. Draft-only;
     *  the discount value it contributes flows through the same discountApprovalRequired/
     *  discountApproved threshold check as any other discount (see BillingService
     *  #computeDiscountApproval). Null when no redemption is applied. */
    loyaltyRedemption: {
      type: new mongoose.Schema(
        {
          points: { type: Number, required: true, min: 1 },
          valueInr: { type: Number, required: true, min: 0 },
          ledgerEntryIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
          patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null },
          appliedAt: { type: Date, default: Date.now },
          appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        },
        { _id: false }
      ),
      default: null,
    },
    tax: { type: Number, default: 0, min: 0 },
    taxPercent: { type: Number, default: 0, min: 0 },
    gstPlaceholder: { type: Boolean, default: true },
    total: { type: Number, default: 0, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    balanceAmount: { type: Number, default: 0, min: 0 },
    advanceApplied: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: null },
    finalizedAt: { type: Date, default: null },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    printedAt: { type: Date, default: null },
    printCount: { type: Number, default: 0 },
    emailPlaceholderSent: { type: Boolean, default: false },
    whatsappPlaceholderSent: { type: Boolean, default: false },
    timeline: {
      type: [
        {
          at: { type: Date, default: Date.now },
          action: { type: String, required: true },
          note: { type: String, default: null },
          actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        },
      ],
      default: [],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'invoices',
  }
);

invoiceSchema.index({ patientId: 1, createdAt: -1 });
invoiceSchema.index({ branchId: 1, invoiceDate: -1 });
invoiceSchema.index({ paymentStatus: 1, status: 1 });

invoiceSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    invoiceNumber: this.invoiceNumber,
    invoiceDate: this.invoiceDate,
    patientId: this.patientId?.toString?.() || this.patientId,
    branchId: this.branchId?.toString?.() || this.branchId,
    doctorId: this.doctorId ? this.doctorId.toString() : null,
    consultationId: this.consultationId ? this.consultationId.toString() : null,
    treatmentPlanId: this.treatmentPlanId ? this.treatmentPlanId.toString() : null,
    appointmentId: this.appointmentId ? this.appointmentId.toString() : null,
    status: this.status,
    paymentStatus: this.paymentStatus,
    items: (this.items || []).map((item) => ({
      id: item._id?.toString?.() || undefined,
      itemType: item.itemType,
      referenceId: item.referenceId ? item.referenceId.toString() : null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      tax: item.tax,
      total: item.total,
    })),
    packageSnapshot: this.packageSnapshot
      ? {
          packageId: this.packageSnapshot.packageId
            ? this.packageSnapshot.packageId.toString()
            : null,
          packageName: this.packageSnapshot.packageName,
          packagePrice: this.packageSnapshot.packagePrice,
          discount: this.packageSnapshot.discount,
          validityDays: this.packageSnapshot.validityDays,
          maximumSessions: this.packageSnapshot.maximumSessions,
          unusedSessions: this.packageSnapshot.unusedSessions,
        }
      : null,
    subtotal: this.subtotal,
    discount: this.discount,
    discountType: this.discountType,
    discountValue: this.discountValue,
    discountApprovalRequired: this.discountApprovalRequired,
    discountApproved: this.discountApproved,
    loyaltyRedemption: this.loyaltyRedemption
      ? {
          points: this.loyaltyRedemption.points,
          valueInr: this.loyaltyRedemption.valueInr,
          ledgerEntryIds: (this.loyaltyRedemption.ledgerEntryIds || []).map((eid) => eid.toString()),
          patientId: this.loyaltyRedemption.patientId
            ? this.loyaltyRedemption.patientId.toString()
            : null,
          appliedAt: this.loyaltyRedemption.appliedAt,
          appliedBy: this.loyaltyRedemption.appliedBy
            ? this.loyaltyRedemption.appliedBy.toString()
            : null,
        }
      : null,
    tax: this.tax,
    taxPercent: this.taxPercent,
    gstPlaceholder: this.gstPlaceholder,
    total: this.total,
    paidAmount: this.paidAmount,
    balanceAmount: this.balanceAmount,
    advanceApplied: this.advanceApplied,
    notes: this.notes,
    finalizedAt: this.finalizedAt,
    finalizedBy: this.finalizedBy ? this.finalizedBy.toString() : null,
    voidedAt: this.voidedAt,
    printedAt: this.printedAt,
    printCount: this.printCount,
    emailPlaceholderSent: this.emailPlaceholderSent,
    whatsappPlaceholderSent: this.whatsappPlaceholderSent,
    timeline: (this.timeline || []).map((t) => ({
      at: t.at,
      action: t.action,
      note: t.note,
      actorId: t.actorId ? t.actorId.toString() : null,
    })),
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Invoice = mongoose.model('Invoice', invoiceSchema);

export default Invoice;
