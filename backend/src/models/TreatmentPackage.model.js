import mongoose from 'mongoose';
import { TREATMENT_CATEGORIES } from '../enums/treatmentPlan.js';

/**
 * Package pricing definitions for treatment plans.
 * No billing / invoicing — pricing metadata only.
 */
const treatmentPackageSchema = new mongoose.Schema(
  {
    packageCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, index: true },
    category: {
      type: String,
      enum: [...TREATMENT_CATEGORIES, null],
      default: 'Other',
    },
    description: { type: String, default: null },
    packagePrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    /** Validity in days from plan acceptance */
    validityDays: { type: Number, default: 90, min: 1 },
    maximumSessions: { type: Number, required: true, min: 1 },
    protocolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TreatmentProtocol',
      default: null,
      index: true,
    },
    /**
     * Package catalog entries are org-wide by default (packageCode is globally unique), so
     * branchId is optional here — it only records current "ownership" for the simple transfer
     * workflow (see TreatmentPlanService.transferPackageOwnership), not a hard scoping rule
     * like InventoryItem.branchId.
     */
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
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
    collection: 'treatment_packages',
  }
);

treatmentPackageSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    packageCode: this.packageCode,
    name: this.name,
    category: this.category,
    description: this.description,
    packagePrice: this.packagePrice,
    discount: this.discount,
    validityDays: this.validityDays,
    maximumSessions: this.maximumSessions,
    protocolId: this.protocolId ? this.protocolId.toString() : null,
    branchId: this.branchId ? this.branchId.toString() : null,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const TreatmentPackage = mongoose.model('TreatmentPackage', treatmentPackageSchema);

export default TreatmentPackage;
