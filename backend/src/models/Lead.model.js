import mongoose from 'mongoose';
import {
  LEAD_PRIORITY,
  LEAD_PRIORITY_LIST,
  LEAD_STATUS,
  LEAD_STATUS_LIST,
} from '../enums/crm.js';
import { GENDER_LIST } from '../enums/gender.js';
import { PATIENT_SOURCE_CATEGORY_LIST } from '../enums/patient.js';

const leadSchema = new mongoose.Schema(
  {
    leadNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, default: null, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    alternatePhone: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
    gender: {
      type: String,
      enum: [...GENDER_LIST, null],
      default: null,
    },
    age: { type: Number, default: null, min: 0, max: 120 },
    city: { type: String, default: null, trim: true },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Master',
      default: null,
      index: true,
    },
    source: { type: String, default: null, trim: true, index: true },
    /**
     * §12.5/CRM-001 acquisition taxonomy — same fixed list as Patient.sourceCategory
     * (enums/patient.js#PATIENT_SOURCE_CATEGORY_LIST) so a converted lead's source lines up with
     * the patient record it becomes. `source` above stays as free-text for anything not covered
     * (e.g. a specific Master-linked sub-source via `sourceId`); this is the typed category.
     */
    sourceCategory: {
      type: String,
      enum: [...PATIENT_SOURCE_CATEGORY_LIST, null],
      default: null,
      index: true,
    },
    /** First-touch acquisition category, preserved even if `sourceCategory` is later corrected. */
    firstTouchSourceCategory: {
      type: String,
      enum: [...PATIENT_SOURCE_CATEGORY_LIST, null],
      default: null,
    },
    campaign: { type: String, default: null, trim: true },
    adSet: { type: String, default: null, trim: true },
    keyword: { type: String, default: null, trim: true },
    referralCode: { type: String, default: null, trim: true, index: true },
    referrerPatientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      default: null,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    interestedServices: { type: [String], default: [] },
    budget: { type: Number, default: null, min: 0 },
    priority: {
      type: String,
      enum: LEAD_PRIORITY_LIST,
      default: LEAD_PRIORITY.MEDIUM,
      index: true,
    },
    status: {
      type: String,
      enum: LEAD_STATUS_LIST,
      default: LEAD_STATUS.NEW,
      index: true,
    },
    remarks: { type: String, default: null },
    nextFollowUp: { type: Date, default: null, index: true },
    lostReason: { type: String, default: null },
    convertedPatientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      default: null,
      index: true,
    },
    convertedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'leads',
  }
);

leadSchema.index({ status: 1, branchId: 1 });
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ firstName: 'text', lastName: 'text', phone: 'text', email: 'text' });

leadSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    leadNumber: this.leadNumber,
    firstName: this.firstName,
    lastName: this.lastName,
    fullName: `${this.firstName} ${this.lastName || ''}`.trim(),
    phone: this.phone,
    alternatePhone: this.alternatePhone,
    email: this.email,
    gender: this.gender,
    age: this.age,
    city: this.city,
    sourceId: this.sourceId?.toString?.() || this.sourceId || null,
    source: this.source,
    sourceCategory: this.sourceCategory,
    firstTouchSourceCategory: this.firstTouchSourceCategory,
    campaign: this.campaign,
    adSet: this.adSet,
    keyword: this.keyword,
    referralCode: this.referralCode,
    referrerPatientId: this.referrerPatientId?.toString?.() || null,
    branchId: this.branchId?.toString?.() || this.branchId,
    assignedTo: this.assignedTo?.toString?.() || this.assignedTo || null,
    interestedServices: this.interestedServices || [],
    budget: this.budget,
    priority: this.priority,
    status: this.status,
    remarks: this.remarks,
    nextFollowUp: this.nextFollowUp,
    lostReason: this.lostReason,
    convertedPatientId: this.convertedPatientId?.toString?.() || null,
    convertedAt: this.convertedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
