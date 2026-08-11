import mongoose from 'mongoose';
import {
  DISPENSE_STATUS,
  DISPENSE_STATUS_LIST,
  DISPENSE_ITEM_STATUS,
  DISPENSE_ITEM_STATUS_LIST,
  SALE_TYPE,
  SALE_TYPE_LIST,
} from '../enums/inventory.js';

/**
 * PHARM-SUBST — substitution is recorded SEPARATELY from the prescription line it was filled
 * against; the signed Prescription document itself is never touched. `originalMedicineId` /
 * name capture what was prescribed (denormalized off the dispense item at the time of the
 * swap), `substitutedMedicineId`/name capture what was actually handed over. `reason` and
 * `authorizedBy` are only ever set together with `isSubstituted: true` — enforced in
 * PharmacyService, not at the schema layer, since the reason is conditionally mandatory.
 */
const substitutionSchema = new mongoose.Schema(
  {
    isSubstituted: { type: Boolean, default: false },
    originalMedicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
    originalMedicineName: { type: String, default: null, trim: true },
    substitutedMedicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
    substitutedMedicineName: { type: String, default: null, trim: true },
    reason: { type: String, default: null, trim: true },
    authorizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    authorizedAt: { type: Date, default: null },
  },
  { _id: false }
);

const dispenseItemSchema = new mongoose.Schema(
  {
    prescriptionItemIndex: { type: Number, required: true, min: 0 },
    medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', default: null },
    medicineName: { type: String, required: true, trim: true },
    inventoryItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryItem',
      default: null,
    },
    batchNumber: { type: String, default: null, trim: true },
    quantityRequested: { type: Number, required: true, min: 0 },
    quantityDispensed: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: DISPENSE_ITEM_STATUS_LIST,
      default: DISPENSE_ITEM_STATUS.PENDING,
    },
    sellingPrice: { type: Number, default: 0, min: 0 },
    substitution: { type: substitutionSchema, default: () => ({}) },
  },
  { _id: true }
);

const dispenseSchema = new mongoose.Schema(
  {
    dispenseNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    /**
     * PHARM-DIRECT — nullable so a direct (retail, no-prescription) sale can use the same model
     * and the same InventoryService.deductStock()/FEFO path as prescription dispensing, without
     * duplicating that logic. `saleType` says which shape a given row is.
     */
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      default: null,
      index: true,
    },
    saleType: {
      type: String,
      enum: SALE_TYPE_LIST,
      default: SALE_TYPE.PRESCRIPTION,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      default: null,
      index: true,
    },
    pharmacistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    items: { type: [dispenseItemSchema], default: [] },
    status: {
      type: String,
      enum: DISPENSE_STATUS_LIST,
      default: DISPENSE_STATUS.PENDING,
      index: true,
    },
    dispensedAt: { type: Date, default: null },
    notes: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'dispenses',
  }
);

dispenseSchema.index({ prescriptionId: 1, status: 1 });

dispenseSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    dispenseNumber: this.dispenseNumber,
    saleType: this.saleType,
    prescriptionId: this.prescriptionId ? this.prescriptionId.toString?.() || this.prescriptionId : null,
    patientId: this.patientId ? this.patientId.toString?.() || this.patientId : null,
    pharmacistId: this.pharmacistId?.toString?.() || null,
    branchId: this.branchId?.toString?.() || this.branchId,
    items: (this.items || []).map((i) => ({
      id: i._id?.toString(),
      prescriptionItemIndex: i.prescriptionItemIndex,
      medicineId: i.medicineId?.toString?.() || null,
      medicineName: i.medicineName,
      inventoryItemId: i.inventoryItemId?.toString?.() || null,
      batchNumber: i.batchNumber,
      quantityRequested: i.quantityRequested,
      quantityDispensed: i.quantityDispensed,
      status: i.status,
      sellingPrice: i.sellingPrice,
      substitution: i.substitution
        ? {
            isSubstituted: !!i.substitution.isSubstituted,
            originalMedicineId: i.substitution.originalMedicineId
              ? i.substitution.originalMedicineId.toString()
              : null,
            originalMedicineName: i.substitution.originalMedicineName || null,
            substitutedMedicineId: i.substitution.substitutedMedicineId
              ? i.substitution.substitutedMedicineId.toString()
              : null,
            substitutedMedicineName: i.substitution.substitutedMedicineName || null,
            reason: i.substitution.reason || null,
            authorizedBy: i.substitution.authorizedBy
              ? i.substitution.authorizedBy.toString()
              : null,
            authorizedAt: i.substitution.authorizedAt || null,
          }
        : { isSubstituted: false },
    })),
    status: this.status,
    dispensedAt: this.dispensedAt,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Dispense = mongoose.model('Dispense', dispenseSchema);

export default Dispense;
