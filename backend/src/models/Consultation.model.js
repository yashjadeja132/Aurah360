import mongoose from 'mongoose';
import {
  CONSULTATION_STATUS,
  CONSULTATION_STATUS_LIST,
  FOLLOW_UP_UNIT_LIST,
  FOLLOW_UP_PRIORITY,
  FOLLOW_UP_PRIORITY_LIST,
  CONTENT_CLASSIFICATION,
  CONTENT_CLASSIFICATION_LIST,
} from '../enums/consultation.js';

/**
 * §3.7 — one classified note section as of the last release. `classification` defaults to
 * INTERNAL_CLINICAL (never PATIENT_FACING) so pre-existing/legacy content that predates this
 * field is never treated as patient-visible just because it exists.
 */
const releaseSectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    label: { type: String, default: null },
    text: { type: String, default: '' },
    classification: {
      type: String,
      enum: CONTENT_CLASSIFICATION_LIST,
      default: CONTENT_CLASSIFICATION.INTERNAL_CLINICAL,
    },
  },
  { _id: false }
);

const followUpSchema = new mongoose.Schema(
  {
    value: { type: Number, default: null },
    unit: { type: String, enum: [...FOLLOW_UP_UNIT_LIST, null], default: null },
    reason: { type: String, default: null },
    instructions: { type: String, default: null },
    // §3.6 gap-close — priority + preferred doctor/branch so the follow-up order carries
    // enough structure for the (future) appointment module to act on, and for the
    // cross-patient Follow-ups list (§5) to sort/filter without opening each consultation.
    priority: {
      type: String,
      enum: [...FOLLOW_UP_PRIORITY_LIST, null],
      default: FOLLOW_UP_PRIORITY.NORMAL,
    },
    preferredDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      default: null,
    },
    preferredBranchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    // Minimal "reminder plan": a due date + optional note. Full scheduling (creating an
    // actual appointment/reminder job) is intentionally left to the appointment/notification
    // module, which already owns scheduling and reminder delivery — duplicating that here
    // would just create a second, disconnected reminder mechanism.
    reminderDate: { type: Date, default: null },
    reminderNote: { type: String, default: null },
    // Doctor-actionable status for the due/overdue list (§5) — set from the Follow-ups page,
    // not from the consultation workspace itself.
    status: {
      type: String,
      enum: ['PENDING', 'DONE', 'RESCHEDULED'],
      default: 'PENDING',
    },
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
    /**
     * EMR-006 / §3.7 — internal note stays internal; only PATIENT_FACING-classified sections ever
     * release to the patient app/portal. `patientFacingSummary` is kept as the derived, flattened
     * text of only those sections (join of `releaseSections` where classification===PATIENT_FACING)
     * so existing consumers (PatientPortalService, etc.) that read this single field keep working
     * unmodified — the classification only changes what doctors are allowed to put into it.
     */
    patientFacingSummary: { type: String, default: null },
    patientFacingReleasedAt: { type: Date, default: null },
    patientFacingReleasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Per-section classification captured at release time — see releaseSectionSchema above. */
    releaseSections: { type: [releaseSectionSchema], default: [] },
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
// Supports the doctor-scoped Follow-ups due/overdue list (§5) filtering on doctorId + a due
// reminderDate/value+unit without a full collection scan.
consultationSchema.index({ doctorId: 1, 'followUp.reminderDate': 1 });

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
    releaseSections: (this.releaseSections || []).map((s) => ({
      key: s.key,
      label: s.label,
      text: s.text,
      classification: s.classification,
    })),
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const Consultation = mongoose.model('Consultation', consultationSchema);

export default Consultation;
