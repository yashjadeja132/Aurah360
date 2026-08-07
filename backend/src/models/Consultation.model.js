import mongoose from 'mongoose';
import {
  CONSULTATION_STATUS,
  CONSULTATION_STATUS_LIST,
  FOLLOW_UP_UNIT_LIST,
} from '../enums/consultation.js';

const followUpSchema = new mongoose.Schema(
  {
    value: { type: Number, default: null },
    unit: { type: String, enum: [...FOLLOW_UP_UNIT_LIST, null], default: null },
    reason: { type: String, default: null },
    instructions: { type: String, default: null },
  },
  { _id: false }
);

const addendumSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    reason: { type: String, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const consultationSchema = new mongoose.Schema(
  {
    consultationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
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
      enum: CONSULTATION_STATUS_LIST,
      default: CONSULTATION_STATUS.DRAFT,
      index: true,
    },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    duration: { type: Number, default: null },
    signedByDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    signedAt: { type: Date, default: null },
    locked: { type: Boolean, default: false, index: true },
    lockedAt: { type: Date, default: null },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    followUp: { type: followUpSchema, default: () => ({}) },
    chiefComplaint: { type: String, default: null },
    /** EMR-005 — addendum/amendment history; a signed/locked note is never silently overwritten. */
    addenda: { type: [addendumSchema], default: [] },
    /** EMR-006 — internal note stays internal; only this explicitly doctor-approved text releases to the patient app/portal. */
    patientFacingSummary: { type: String, default: null },
    patientFacingReleasedAt: { type: Date, default: null },
    patientFacingReleasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'consultations',
  }
);

consultationSchema.index({ appointmentId: 1, deletedAt: 1 });
consultationSchema.index({ patientId: 1, startedAt: -1 });

consultationSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    consultationNumber: this.consultationNumber,
    appointmentId: this.appointmentId?.toString?.() || this.appointmentId,
    patientId: this.patientId?.toString?.() || this.patientId,
    doctorId: this.doctorId?.toString?.() || this.doctorId,
    branchId: this.branchId?.toString?.() || this.branchId,
    status: this.status,
    startedAt: this.startedAt,
    endedAt: this.endedAt,
    duration: this.duration,
    signedByDoctor: this.signedByDoctor ? this.signedByDoctor.toString() : null,
    signedAt: this.signedAt,
    locked: this.locked,
    lockedAt: this.lockedAt,
    lockedBy: this.lockedBy ? this.lockedBy.toString() : null,
    followUp: this.followUp,
    chiefComplaint: this.chiefComplaint,
    addenda: this.addenda,
    patientFacingSummary: this.patientFacingSummary,
    patientFacingReleasedAt: this.patientFacingReleasedAt,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Consultation = mongoose.model('Consultation', consultationSchema);

export default Consultation;
