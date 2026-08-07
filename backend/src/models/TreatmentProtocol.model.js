import mongoose from 'mongoose';
import { TREATMENT_CATEGORIES } from '../enums/treatmentPlan.js';

/**
 * Predefined treatment protocols — doctor selects to auto-fill plan items.
 * Does not create treatment sessions.
 */
const protocolItemSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Master',
      default: null,
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
    /** TRT-006 — hard-stop preflight requirements for this protocol item. */
    patchTestRequired: { type: Boolean, default: false },
    consentRequired: { type: Boolean, default: true },
    requiredSkillCode: { type: String, default: null },
    parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);

const treatmentProtocolSchema = new mongoose.Schema(
  {
    protocolCode: {
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
    clinicalGoal: { type: String, default: null },
    estimatedDuration: { type: String, default: null },
    estimatedSessions: { type: Number, default: 1 },
    items: { type: [protocolItemSchema], default: [] },
    defaultConsents: { type: [String], default: [] },
    /** §10.2 versioning — completed sessions keep the version used; new versions apply prospectively. */
    version: { type: Number, default: 1 },
    previousVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TreatmentProtocol', default: null },
    effectiveFrom: { type: Date, default: () => new Date() },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    contraindicationQuestions: { type: [String], default: [] },
    ageRestrictionMin: { type: Number, default: null },
    ageRestrictionMax: { type: Number, default: null },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'treatment_protocols',
  }
);

treatmentProtocolSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    protocolCode: this.protocolCode,
    name: this.name,
    category: this.category,
    description: this.description,
    clinicalGoal: this.clinicalGoal,
    estimatedDuration: this.estimatedDuration,
    estimatedSessions: this.estimatedSessions,
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
      patchTestRequired: item.patchTestRequired,
      consentRequired: item.consentRequired,
      requiredSkillCode: item.requiredSkillCode,
      parameters: item.parameters || {},
    })),
    defaultConsents: this.defaultConsents || [],
    version: this.version,
    previousVersionId: this.previousVersionId ? this.previousVersionId.toString() : null,
    effectiveFrom: this.effectiveFrom,
    approvedBy: this.approvedBy ? this.approvedBy.toString() : null,
    approvedAt: this.approvedAt,
    contraindicationQuestions: this.contraindicationQuestions || [],
    ageRestrictionMin: this.ageRestrictionMin,
    ageRestrictionMax: this.ageRestrictionMax,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const TreatmentProtocol = mongoose.model('TreatmentProtocol', treatmentProtocolSchema);

export default TreatmentProtocol;
