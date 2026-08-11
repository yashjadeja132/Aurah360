import mongoose from 'mongoose';
import { MEDICINE_ROUTE_LIST, PRESCRIPTION_STATUS, PRESCRIPTION_STATUS_LIST } from '../enums/prescription.js';

const prescriptionItemSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      default: null,
      index: true,
    },
    medicineName: { type: String, required: true, trim: true },
    genericName: { type: String, default: null },
    strength: { type: String, default: null },
    dosage: { type: String, default: null },
    frequency: { type: String, default: null },
    duration: { type: String, default: null },
    route: {
      type: String,
      enum: [...MEDICINE_ROUTE_LIST, null],
      default: 'ORAL',
    },
    instructions: { type: String, default: null },
    quantity: { type: Number, default: null },
    morning: { type: Boolean, default: false },
    afternoon: { type: Boolean, default: false },
    night: { type: Boolean, default: false },
    beforeFood: { type: Boolean, default: false },
    afterFood: { type: Boolean, default: false },
    remarks: { type: String, default: null },
    /**
     * Spec §3.3 — "{Substitution note if allowed}". This is the PRESCRIBER's own generic/brand
     * substitution instruction written on the Rx line itself, distinct from
     * PharmacyService's dispense-time substitution mechanism (which records what the pharmacy
     * actually swapped at dispense). `substitutionNote` only has meaning when
     * `substitutionAllowed` is true — it isn't enforced back to null when the box is unchecked
     * so a doctor can uncheck-then-recheck without losing the note they already wrote.
     */
    substitutionAllowed: { type: Boolean, default: false },
    substitutionNote: { type: String, default: null },
  },
  { _id: true }
);

/**
 * RX-SAFETY — immutable trail of blocking safety alerts that a prescriber overrode in order to
 * finalize. Shaped after TreatmentSession.hardStopOverrides (the in-repo precedent) so the same
 * "block, then allow an audited override" story reads the same way in both modules.
 */
const safetyOverrideSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    severity: { type: String, default: null },
    medicineName: { type: String, default: null },
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
    detail: { type: String, default: null },
    matchedTerm: { type: String, default: null },
    reason: { type: String, required: true },
    overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    overriddenAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: PRESCRIPTION_STATUS_LIST,
      default: PRESCRIPTION_STATUS.DRAFT,
      index: true,
    },
    notes: { type: String, default: null },
    items: { type: [prescriptionItemSchema], default: [] },
    safetyOverrides: { type: [safetyOverrideSchema], default: [] },
    finalizedAt: { type: Date, default: null },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    printedAt: { type: Date, default: null },
    printCount: { type: Number, default: 0 },
    duplicatedFromId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      default: null,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'prescriptions',
  }
);

prescriptionSchema.index({ consultationId: 1, status: 1 });
prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ doctorId: 1, createdAt: -1 });

prescriptionSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    prescriptionNumber: this.prescriptionNumber,
    consultationId: this.consultationId?.toString?.() || this.consultationId,
    patientId: this.patientId?.toString?.() || this.patientId,
    doctorId: this.doctorId?.toString?.() || this.doctorId,
    branchId: this.branchId?.toString?.() || this.branchId,
    status: this.status,
    notes: this.notes,
    items: (this.items || []).map((item) => ({
      id: item._id?.toString?.() || undefined,
      medicineId: item.medicineId ? item.medicineId.toString() : null,
      medicineName: item.medicineName,
      genericName: item.genericName,
      strength: item.strength,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      route: item.route,
      instructions: item.instructions,
      quantity: item.quantity,
      morning: item.morning,
      afternoon: item.afternoon,
      night: item.night,
      beforeFood: item.beforeFood,
      afterFood: item.afterFood,
      remarks: item.remarks,
      substitutionAllowed: item.substitutionAllowed,
      substitutionNote: item.substitutionNote,
    })),
    safetyOverrides: (this.safetyOverrides || []).map((o) => ({
      id: o._id?.toString?.() || undefined,
      type: o.type,
      severity: o.severity,
      medicineName: o.medicineName,
      medicineId: o.medicineId ? o.medicineId.toString() : null,
      detail: o.detail,
      matchedTerm: o.matchedTerm,
      reason: o.reason,
      overriddenBy: o.overriddenBy ? o.overriddenBy.toString() : null,
      overriddenAt: o.overriddenAt,
    })),
    finalizedAt: this.finalizedAt,
    finalizedBy: this.finalizedBy ? this.finalizedBy.toString() : null,
    printedAt: this.printedAt,
    printCount: this.printCount,
    duplicatedFromId: this.duplicatedFromId ? this.duplicatedFromId.toString() : null,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Prescription = mongoose.model('Prescription', prescriptionSchema);

export default Prescription;
