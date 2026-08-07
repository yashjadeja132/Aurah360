import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { ENTITY_STATUS } from '../constants/index.js';
import { GENDER_LIST } from '../enums/gender.js';
import { BLOOD_GROUP_LIST, MARITAL_STATUS_LIST } from '../enums/patient.js';

const addressSchema = new mongoose.Schema(
  {
    addressLine1: { type: String, trim: true, default: null },
    addressLine2: { type: String, trim: true, default: null },
    city: { type: String, trim: true, default: null },
    state: { type: String, trim: true, default: null },
    country: { type: String, trim: true, default: 'India' },
    postalCode: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: null },
    relationship: { type: String, trim: true, default: null },
    phone: { type: String, trim: true, default: null },
  },
  { _id: false }
);

const medicalInfoSchema = new mongoose.Schema(
  {
    heightCm: { type: Number, min: 0, default: null },
    weightKg: { type: Number, min: 0, default: null },
    allergies: { type: String, default: null },
    chronicDiseases: { type: String, default: null },
    pastMedicalHistory: { type: String, default: null },
    pastSurgicalHistory: { type: String, default: null },
    currentMedications: { type: String, default: null },
    smoking: { type: String, default: null },
    alcohol: { type: String, default: null },
    pregnancyStatus: { type: String, default: null },
    generalNotes: { type: String, default: null },
  },
  { _id: false }
);

const consentSchema = new mongoose.Schema(
  {
    privacyPolicy: { type: Boolean, default: false },
    treatmentConsent: { type: Boolean, default: false },
    photographyConsent: { type: Boolean, default: false },
    marketingConsent: { type: Boolean, default: false },
    eSignPlaceholder: { type: String, default: null },
    acceptedAt: { type: Date, default: null },
  },
  { _id: false }
);

const patientSchema = new mongoose.Schema(
  {
    uuid: {
      type: String,
      default: () => randomUUID(),
      unique: true,
      index: true,
    },
    mrn: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    patientCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true, default: null },
    lastName: { type: String, required: true, trim: true },
    gender: { type: String, enum: GENDER_LIST, required: true },
    dateOfBirth: { type: Date, default: null },
    bloodGroup: { type: String, enum: BLOOD_GROUP_LIST, default: null },
    maritalStatus: { type: String, enum: MARITAL_STATUS_LIST, default: null },
    photo: { type: String, default: null },
    mobile: { type: String, required: true, trim: true, index: true },
    alternateMobile: { type: String, trim: true, default: null },
    email: { type: String, trim: true, lowercase: true, default: null, index: true },
    /** Portal credentials — never exposed via toSafeObject */
    passwordHash: { type: String, default: null, select: false },
    portalEnabled: { type: Boolean, default: false, index: true },
    emailVerified: { type: Boolean, default: false },
    lastPortalLogin: { type: Date, default: null },
    preferredLanguage: { type: String, default: 'en' },
    occupation: { type: String, default: null },
    nationality: { type: String, default: 'Indian' },
    address: { type: addressSchema, default: () => ({}) },
    emergencyContact: { type: emergencyContactSchema, default: () => ({}) },
    medical: { type: medicalInfoSchema, default: () => ({}) },
    primaryBranchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },
    primaryDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
      index: true,
    },
    leadSourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Master',
      default: null,
    },
    referredBy: { type: String, default: null },
    /** Source/referral taxonomy (PAT-003, §5.1, §12.5) */
    sourceCategory: {
      type: String,
      enum: [
        'GOOGLE',
        'WEBSITE',
        'FACEBOOK_AD',
        'INSTAGRAM_AD',
        'WHATSAPP',
        'WALK_IN',
        'PERSON_REFERRAL',
        'PATIENT_REFERRAL',
        'DOCTOR_REFERRAL',
        'EVENT',
        'OTHER',
      ],
      default: null,
    },
    campaign: { type: String, default: null, trim: true },
    firstTouchSourceCategory: { type: String, default: null },
    /** Guardian / dependent (PAT-005) — set when this patient is a minor or a dependent of another record. */
    isDependent: { type: Boolean, default: false, index: true },
    guardianPatientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null, index: true },
    guardianName: { type: String, trim: true, default: null },
    guardianRelationship: { type: String, trim: true, default: null },
    guardianPhone: { type: String, trim: true, default: null },
    guardianVerified: { type: Boolean, default: false },
    /** Migration provenance (PAT-008) */
    sourceSystem: { type: String, default: null },
    sourceRecordId: { type: String, default: null, index: true },
    importBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportBatch', default: null },
    importConfidence: { type: String, enum: ['VERIFIED', 'UNVERIFIED', null], default: null },
    registrationDate: { type: Date, default: () => new Date(), index: true },
    status: {
      type: String,
      enum: Object.values(ENTITY_STATUS),
      default: ENTITY_STATUS.ACTIVE,
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
    isVip: { type: Boolean, default: false, index: true },
    isBlacklisted: { type: Boolean, default: false },
    tags: { type: [String], default: [], index: true },
    consent: { type: consentSchema, default: () => ({}) },
    notes: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'patients',
  }
);

patientSchema.index({
  firstName: 'text',
  lastName: 'text',
  middleName: 'text',
  mrn: 'text',
  patientCode: 'text',
  mobile: 'text',
  email: 'text',
});

patientSchema.virtual('fullName').get(function fullName() {
  return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(' ');
});

patientSchema.methods.computeAge = function computeAge(asOf = new Date()) {
  if (!this.dateOfBirth) return null;
  const dob = new Date(this.dateOfBirth);
  let age = asOf.getFullYear() - dob.getFullYear();
  const m = asOf.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
};

patientSchema.methods.computeBmi = function computeBmi() {
  const h = this.medical?.heightCm;
  const w = this.medical?.weightKg;
  if (!h || !w || h <= 0) return null;
  const meters = h / 100;
  return Number((w / (meters * meters)).toFixed(1));
};

patientSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    uuid: this.uuid,
    mrn: this.mrn,
    patientCode: this.patientCode,
    firstName: this.firstName,
    middleName: this.middleName,
    lastName: this.lastName,
    fullName: [this.firstName, this.middleName, this.lastName].filter(Boolean).join(' '),
    gender: this.gender,
    dateOfBirth: this.dateOfBirth,
    age: this.computeAge(),
    bloodGroup: this.bloodGroup,
    maritalStatus: this.maritalStatus,
    photo: this.photo,
    mobile: this.mobile,
    alternateMobile: this.alternateMobile,
    email: this.email,
    preferredLanguage: this.preferredLanguage,
    occupation: this.occupation,
    nationality: this.nationality,
    address: this.address,
    emergencyContact: this.emergencyContact,
    medical: {
      ...(this.medical?.toObject?.() || this.medical || {}),
      bmi: this.computeBmi(),
    },
    primaryBranchId: this.primaryBranchId ? this.primaryBranchId.toString() : null,
    primaryDoctorId: this.primaryDoctorId ? this.primaryDoctorId.toString() : null,
    leadSourceId: this.leadSourceId ? this.leadSourceId.toString() : null,
    referredBy: this.referredBy,
    sourceCategory: this.sourceCategory,
    campaign: this.campaign,
    firstTouchSourceCategory: this.firstTouchSourceCategory,
    isDependent: this.isDependent,
    guardianPatientId: this.guardianPatientId ? this.guardianPatientId.toString() : null,
    guardianName: this.guardianName,
    guardianRelationship: this.guardianRelationship,
    guardianPhone: this.guardianPhone,
    guardianVerified: this.guardianVerified,
    sourceSystem: this.sourceSystem,
    sourceRecordId: this.sourceRecordId,
    importConfidence: this.importConfidence,
    registrationDate: this.registrationDate,
    status: this.status,
    isActive: this.isActive,
    isVip: this.isVip,
    isBlacklisted: this.isBlacklisted,
    tags: this.tags || [],
    consent: this.consent,
    portalEnabled: this.portalEnabled,
    emailVerified: this.emailVerified,
    lastPortalLogin: this.lastPortalLogin,
    notes: this.notes,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Patient = mongoose.model('Patient', patientSchema);

export default Patient;
