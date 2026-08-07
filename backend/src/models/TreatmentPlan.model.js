import mongoose from 'mongoose';
import {
  EDITABLE_TREATMENT_PLAN_STATUSES,
  TREATMENT_CATEGORIES,
  TREATMENT_PLAN_PRIORITY,
  TREATMENT_PLAN_PRIORITY_LIST,
  TREATMENT_PLAN_STATUS,
  TREATMENT_PLAN_STATUS_LIST,
} from '../enums/treatmentPlan.js';

/**
 * Treatment plan item (procedure within a plan).
 * Planning only — does not create treatment sessions.
 */
const treatmentPlanItemSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Master',
      default: null,
      index: true,
    },
    procedureName: { type: String, required: true, trim: true },
    sessionCount: { type: Number, default: 1, min: 1 },
    sessionDuration: { type: Number, default: 30, min: 1 },
    frequency: { type: String, default: null },
    deviceRequired: { type: String, default: null },
    roomRequired: { type: String, default: null },
    technicianRequired: { type: Boolean, default: true },
    consumables: { type: [String], default: [] },
    preInstructions: { type: String, default: null },
    postInstructions: { type: String, default: null },
    notes: { type: String, default: null },
    protocolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TreatmentProtocol',
      default: null,
    },
  },
  { _id: true }
);

const packageSnapshotSchema = new mongoose.Schema(
  {
    packageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TreatmentPackage',
      default: null,
    },
    packageName: { type: String, default: null },
    packagePrice: { type: Number, default: null },
    discount: { type: Number, default: 0 },
    validityDays: { type: Number, default: null },
    maximumSessions: { type: Number, default: null },
    unusedSessions: { type: Number, default: null },
  },
  { _id: false }
);

const goalsSchema = new mongoose.Schema(
  {
    expectedResults: { type: String, default: null },
    clinicalObjectives: { type: String, default: null },
    beforePhotosReference: { type: String, default: null },
    reviewDate: { type: Date, default: null },
  },
  { _id: false }
);

const followUpSchema = new mongoose.Schema(
  {
    reviewAfterDays: { type: Number, default: null, min: 0 },
    reviewAfterSession: { type: Number, default: null, min: 1 },
  },
  { _id: false }
);

const treatmentPlanSchema = new mongoose.Schema(
  {
    planNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
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
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    category: {
      type: String,
      enum: [...TREATMENT_CATEGORIES, null],
      default: 'Other',
    },
    clinicalGoal: { type: String, default: null },
    estimatedDuration: { type: String, default: null },
    estimatedSessions: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: TREATMENT_PLAN_STATUS_LIST,
      default: TREATMENT_PLAN_STATUS.DRAFT,
      index: true,
    },
    priority: {
      type: String,
      enum: TREATMENT_PLAN_PRIORITY_LIST,
      default: TREATMENT_PLAN_PRIORITY.NORMAL,
      index: true,
    },
    remarks: { type: String, default: null },
    diagnosisSummary: { type: String, default: null },
    protocolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TreatmentProtocol',
      default: null,
      index: true,
    },
    items: { type: [treatmentPlanItemSchema], default: [] },
    packageSnapshot: { type: packageSnapshotSchema, default: null },
    goals: { type: goalsSchema, default: () => ({}) },
    followUp: { type: followUpSchema, default: () => ({}) },
    recommendedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedAt: { type: Date, default: null },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    printedAt: { type: Date, default: null },
    printCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'treatment_plans',
  }
);

treatmentPlanSchema.index({ consultationId: 1, status: 1 });
treatmentPlanSchema.index({ patientId: 1, createdAt: -1 });
treatmentPlanSchema.index({ doctorId: 1, createdAt: -1 });

treatmentPlanSchema.methods.isEditable = function isEditable() {
  return EDITABLE_TREATMENT_PLAN_STATUSES.includes(this.status);
};

treatmentPlanSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    planNumber: this.planNumber,
    consultationId: this.consultationId?.toString?.() || this.consultationId,
    patientId: this.patientId?.toString?.() || this.patientId,
    doctorId: this.doctorId?.toString?.() || this.doctorId,
    branchId: this.branchId?.toString?.() || this.branchId,
    title: this.title,
    description: this.description,
    category: this.category,
    clinicalGoal: this.clinicalGoal,
    estimatedDuration: this.estimatedDuration,
    estimatedSessions: this.estimatedSessions,
    status: this.status,
    priority: this.priority,
    remarks: this.remarks,
    diagnosisSummary: this.diagnosisSummary,
    protocolId: this.protocolId ? this.protocolId.toString() : null,
    items: (this.items || []).map((item) => ({
      id: item._id?.toString?.() || undefined,
      serviceId: item.serviceId ? item.serviceId.toString() : null,
      procedureName: item.procedureName,
      sessionCount: item.sessionCount,
      sessionDuration: item.sessionDuration,
      frequency: item.frequency,
      deviceRequired: item.deviceRequired,
      roomRequired: item.roomRequired,
      technicianRequired: item.technicianRequired,
      consumables: item.consumables || [],
      preInstructions: item.preInstructions,
      postInstructions: item.postInstructions,
      notes: item.notes,
      protocolId: item.protocolId ? item.protocolId.toString() : null,
    })),
    packageSnapshot: this.packageSnapshot
      ? {
          packageId: this.packageSnapshot.packageId
            ? this.packageSnapshot.packageId.toString()
            : null,
          packageName: this.packageSnapshot.packageName,
          packagePrice: this.packageSnapshot.packagePrice,
          discount: this.packageSnapshot.discount,
          validityDays: this.packageSnapshot.validityDays,
          maximumSessions: this.packageSnapshot.maximumSessions,
          unusedSessions: this.packageSnapshot.unusedSessions,
        }
      : null,
    goals: {
      expectedResults: this.goals?.expectedResults ?? null,
      clinicalObjectives: this.goals?.clinicalObjectives ?? null,
      beforePhotosReference: this.goals?.beforePhotosReference ?? null,
      reviewDate: this.goals?.reviewDate ?? null,
    },
    followUp: {
      reviewAfterDays: this.followUp?.reviewAfterDays ?? null,
      reviewAfterSession: this.followUp?.reviewAfterSession ?? null,
    },
    recommendedAt: this.recommendedAt,
    approvedAt: this.approvedAt,
    approvedBy: this.approvedBy ? this.approvedBy.toString() : null,
    acceptedAt: this.acceptedAt,
    acceptedBy: this.acceptedBy ? this.acceptedBy.toString() : null,
    rejectedAt: this.rejectedAt,
    rejectionReason: this.rejectionReason,
    cancelledAt: this.cancelledAt,
    completedAt: this.completedAt,
    printedAt: this.printedAt,
    printCount: this.printCount,
    createdBy: this.createdBy ? this.createdBy.toString() : null,
    updatedBy: this.updatedBy ? this.updatedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const TreatmentPlan = mongoose.model('TreatmentPlan', treatmentPlanSchema);

export { treatmentPlanItemSchema };
export default TreatmentPlan;
