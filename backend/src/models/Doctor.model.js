import mongoose from 'mongoose';
import { ENTITY_STATUS } from '../constants/index.js';
import { GENDER_LIST } from '../enums/gender.js';

/**
 * Doctor profile — clinical/scheduling data only.
 * Identity (name, email, phone) lives on User via userId.
 */
const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    doctorCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    qualification: { type: String, trim: true, default: null },
    specialization: { type: String, trim: true, default: null },
    experienceYears: { type: Number, min: 0, default: 0 },
    bio: { type: String, default: null },
    consultationDuration: { type: Number, min: 5, max: 240, default: 15 },
    consultationFee: { type: Number, min: 0, default: 0 },
    followUpFee: { type: Number, min: 0, default: 0 },
    departments: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Master' }],
      default: [],
    },
    services: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Master' }],
      default: [],
    },
    branches: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
      default: [],
    },
    languages: { type: [String], default: ['en'] },
    gender: { type: String, enum: GENDER_LIST, default: null },
    signatureImage: { type: String, default: null },
    profilePhoto: { type: String, default: null },
    colorCode: { type: String, default: '#2563eb' },
    isAvailableOnline: { type: Boolean, default: false },
    status: {
      type: String,
      enum: Object.values(ENTITY_STATUS),
      default: ENTITY_STATUS.ACTIVE,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'doctors',
  }
);

doctorSchema.index({ specialization: 'text', qualification: 'text', doctorCode: 'text' });

doctorSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    userId: this.userId?.toString?.() || this.userId,
    doctorCode: this.doctorCode,
    licenseNumber: this.licenseNumber,
    registrationNumber: this.registrationNumber,
    qualification: this.qualification,
    specialization: this.specialization,
    experienceYears: this.experienceYears,
    bio: this.bio,
    consultationDuration: this.consultationDuration,
    consultationFee: this.consultationFee,
    followUpFee: this.followUpFee,
    departments: (this.departments || []).map((id) => id.toString()),
    services: (this.services || []).map((id) => id.toString()),
    branches: (this.branches || []).map((id) => id.toString()),
    languages: this.languages,
    gender: this.gender,
    signatureImage: this.signatureImage,
    profilePhoto: this.profilePhoto,
    colorCode: this.colorCode,
    isAvailableOnline: this.isAvailableOnline,
    status: this.status,
    isActive: this.isActive,
    notes: this.notes,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Doctor = mongoose.model('Doctor', doctorSchema);

export default Doctor;
