import mongoose from 'mongoose';
import {
  TREATMENT_SESSION_STATUS,
  TREATMENT_SESSION_STATUS_LIST,
} from '../enums/treatmentSession.js';

const deviceUsageSchema = new mongoose.Schema(
  {
    device: { type: String, default: null },
    machine: { type: String, default: null },
    laserHead: { type: String, default: null },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const photoRefSchema = new mongoose.Schema(
  {
    photoId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClinicalPhoto', default: null },
    storageKey: { type: String, required: true },
    originalName: { type: String, default: null },
    mimeType: { type: String, default: null },
    title: { type: String, default: null },
    photoType: { type: String, default: 'BEFORE' },
    url: { type: String, default: null },
  },
  { _id: true }
);

const followUpSchema = new mongoose.Schema(
  {
    nextSessionDate: { type: Date, default: null },
    reviewDate: { type: Date, default: null },
    notes: { type: String, default: null },
  },
  { _id: false }
);

/**
 * TRT-006 — recorded answers to TreatmentProtocol.contraindicationQuestions. Without a place to
 * store the answers the configured questions could never be evaluated, which is exactly why the
 * setting was dead. `answer: true` means the contraindication IS present (a hard stop).
 */
const contraindicationScreeningSchema = new mongoose.Schema(
  {
    screenedAt: { type: Date, default: null },
    screenedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    answers: {
      type: [
        {
          question: { type: String, required: true },
          answer: { type: Boolean, default: null },
          note: { type: String, default: null },
        },
      ],
      default: [],
    },
  },
  { _id: false }
);

const treatmentSessionSchema = new mongoose.Schema(
  {
    sessionNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    treatmentPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TreatmentPlan',
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
    technicianId: {
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
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
      index: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
      index: true,
    },
    protocolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TreatmentProtocol',
      default: null,
    },
    status: {
      type: String,
      enum: TREATMENT_SESSION_STATUS_LIST,
      default: TREATMENT_SESSION_STATUS.SCHEDULED,
      index: true,
    },
    sessionIndex: { type: Number, default: 1, min: 1 },
    scheduledDate: { type: Date, default: null, index: true },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    duration: { type: Number, default: null, min: 0 },
    roomId: { type: String, default: null },
    deviceId: { type: String, default: null },
    /** TRT-003 — structured room/device reservation used for real availability checks. */
    roomRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
    deviceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },
    /** Protocol used at execution time is pinned — later protocol edits never retroactively change a completed session (§10.2 versioning). */
    protocolVersionSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    patchTestId: { type: mongoose.Schema.Types.ObjectId, ref: 'PatchTest', default: null },
    hardStopOverrides: {
      type: [
        {
          type: { type: String },
          reason: { type: String },
          overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          overriddenAt: { type: Date, default: () => new Date() },
        },
      ],
      default: [],
    },
    deviceUsage: { type: deviceUsageSchema, default: () => ({}) },
    contraindicationScreening: { type: contraindicationScreeningSchema, default: null },
    remarks: { type: String, default: null },
    photosBefore: { type: [photoRefSchema], default: [] },
    photosAfter: { type: [photoRefSchema], default: [] },
    complications: { type: String, default: null },
    consumables: { type: [String], default: [] },
    outcome: { type: String, default: null },
    notes: { type: String, default: null },
    followUp: { type: followUpSchema, default: () => ({}) },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'treatment_sessions',
  }
);

treatmentSessionSchema.index({ treatmentPlanId: 1, status: 1 });
treatmentSessionSchema.index({ patientId: 1, scheduledDate: -1 });
treatmentSessionSchema.index({ technicianId: 1, status: 1 });

treatmentSessionSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  const mapPhoto = (p) => ({
    id: p._id?.toString?.() || undefined,
    photoId: p.photoId ? p.photoId.toString() : null,
    storageKey: p.storageKey,
    originalName: p.originalName,
    mimeType: p.mimeType,
    title: p.title,
    photoType: p.photoType,
    url: p.url || (p.photoId ? `/api/v1/files/photos/${p.photoId.toString()}` : null),
  });

  return {
    id: this._id.toString(),
    sessionNumber: this.sessionNumber,
    treatmentPlanId: this.treatmentPlanId?.toString?.() || this.treatmentPlanId,
    patientId: this.patientId?.toString?.() || this.patientId,
    doctorId: this.doctorId?.toString?.() || this.doctorId,
    technicianId: this.technicianId ? this.technicianId.toString() : null,
    branchId: this.branchId?.toString?.() || this.branchId,
    appointmentId: this.appointmentId ? this.appointmentId.toString() : null,
    invoiceId: this.invoiceId ? this.invoiceId.toString() : null,
    protocolId: this.protocolId ? this.protocolId.toString() : null,
    status: this.status,
    sessionIndex: this.sessionIndex,
    scheduledDate: this.scheduledDate,
    startedAt: this.startedAt,
    completedAt: this.completedAt,
    duration: this.duration,
    roomId: this.roomId,
    deviceId: this.deviceId,
    roomRef: this.roomRef ? this.roomRef.toString() : null,
    deviceRef: this.deviceRef ? this.deviceRef.toString() : null,
    protocolVersionSnapshot: this.protocolVersionSnapshot,
    patchTestId: this.patchTestId ? this.patchTestId.toString() : null,
    hardStopOverrides: this.hardStopOverrides,
    deviceUsage: {
      device: this.deviceUsage?.device ?? null,
      machine: this.deviceUsage?.machine ?? null,
      laserHead: this.deviceUsage?.laserHead ?? null,
      settings: this.deviceUsage?.settings || {},
    },
    contraindicationScreening: this.contraindicationScreening
      ? {
          screenedAt: this.contraindicationScreening.screenedAt ?? null,
          screenedBy: this.contraindicationScreening.screenedBy
            ? this.contraindicationScreening.screenedBy.toString()
            : null,
          answers: (this.contraindicationScreening.answers || []).map((a) => ({
            question: a.question,
            answer: a.answer ?? null,
            note: a.note ?? null,
          })),
        }
      : null,
    remarks: this.remarks,
    photosBefore: (this.photosBefore || []).map(mapPhoto),
    photosAfter: (this.photosAfter || []).map(mapPhoto),
    complications: this.complications,
    consumables: this.consumables || [],
    outcome: this.outcome,
    notes: this.notes,
    followUp: {
      nextSessionDate: this.followUp?.nextSessionDate ?? null,
      reviewDate: this.followUp?.reviewDate ?? null,
      notes: this.followUp?.notes ?? null,
    },
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const TreatmentSession = mongoose.model('TreatmentSession', treatmentSessionSchema);

export default TreatmentSession;
