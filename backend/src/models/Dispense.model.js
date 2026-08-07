import mongoose from 'mongoose';
import {
  DISPENSE_STATUS,
  DISPENSE_STATUS_LIST,
  DISPENSE_ITEM_STATUS,
  DISPENSE_ITEM_STATUS_LIST,
} from '../enums/inventory.js';

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
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
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
    prescriptionId: this.prescriptionId?.toString?.() || this.prescriptionId,
    patientId: this.patientId?.toString?.() || this.patientId,
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
