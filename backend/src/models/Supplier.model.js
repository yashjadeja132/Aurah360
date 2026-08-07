import mongoose from 'mongoose';
import { ENTITY_STATUS } from '../constants/index.js';

const supplierSchema = new mongoose.Schema(
  {
    supplierCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, index: true },
    gstin: { type: String, default: null, trim: true, uppercase: true },
    contactName: { type: String, default: null, trim: true },
    phone: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
    address: {
      line1: { type: String, default: null },
      line2: { type: String, default: null },
      city: { type: String, default: null },
      state: { type: String, default: null },
      pincode: { type: String, default: null },
    },
    paymentTerms: { type: String, default: 'Net 30', trim: true },
    notes: { type: String, default: null },
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
    collection: 'suppliers',
  }
);

supplierSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    supplierCode: this.supplierCode,
    name: this.name,
    gstin: this.gstin,
    contactName: this.contactName,
    phone: this.phone,
    email: this.email,
    address: this.address,
    paymentTerms: this.paymentTerms,
    notes: this.notes,
    status: this.status,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Supplier = mongoose.model('Supplier', supplierSchema);

export default Supplier;
