import mongoose from 'mongoose';
import { DOSAGE_FORM_LIST, MEDICINE_ROUTE_LIST } from '../enums/prescription.js';
import { ENTITY_STATUS } from '../constants/index.js';

const medicineSchema = new mongoose.Schema(
  {
    medicineCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, index: true },
    genericName: { type: String, default: null, trim: true, index: true },
    brand: { type: String, default: null, trim: true },
    category: { type: String, default: null, trim: true, index: true },
    strength: { type: String, default: null, trim: true },
    dosageForm: {
      type: String,
      enum: [...DOSAGE_FORM_LIST, null],
      default: null,
    },
    defaultRoute: {
      type: String,
      enum: [...MEDICINE_ROUTE_LIST, null],
      default: null,
    },
    manufacturer: { type: String, default: null, trim: true },
    /** Module 13 — catalog inventory fields (stock lives on InventoryItem batches) */
    sku: { type: String, default: null, trim: true, index: true },
    purchasePrice: { type: Number, default: null, min: 0 },
    sellingPrice: { type: Number, default: null, min: 0 },
    mrp: { type: Number, default: null, min: 0 },
    gstPercent: { type: Number, default: 12, min: 0, max: 100 },
    minimumStock: { type: Number, default: 10, min: 0 },
    maximumStock: { type: Number, default: 1000, min: 0 },
    reorderLevel: { type: Number, default: 20, min: 0 },
    location: { type: String, default: null, trim: true },
    status: {
      type: String,
      enum: Object.values(ENTITY_STATUS),
      default: ENTITY_STATUS.ACTIVE,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'medicines',
  }
);

medicineSchema.index({ name: 'text', genericName: 'text', brand: 'text', medicineCode: 'text' });

medicineSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    medicineCode: this.medicineCode,
    name: this.name,
    genericName: this.genericName,
    brand: this.brand,
    category: this.category,
    strength: this.strength,
    dosageForm: this.dosageForm,
    defaultRoute: this.defaultRoute,
    manufacturer: this.manufacturer,
    sku: this.sku,
    purchasePrice: this.purchasePrice,
    sellingPrice: this.sellingPrice,
    mrp: this.mrp,
    gstPercent: this.gstPercent,
    minimumStock: this.minimumStock,
    maximumStock: this.maximumStock,
    reorderLevel: this.reorderLevel,
    location: this.location,
    status: this.status,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Medicine = mongoose.model('Medicine', medicineSchema);

export default Medicine;
