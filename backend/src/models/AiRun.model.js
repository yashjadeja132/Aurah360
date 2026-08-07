import mongoose from 'mongoose';
import { AI_USE_CASE_LIST, AI_DISPOSITION, AI_DISPOSITION_LIST, AI_RUN_STATUS_LIST } from '../enums/ai.js';

/**
 * PHI-safe AI audit trail (AI-006, §16.8). Stores the de-identified input manifest, the
 * output, and provenance — never the raw prompt/response containing patient identity, and
 * never the patient's name/phone/email/etc. (those are stripped before this record exists).
 */
const aiRunSchema = new mongoose.Schema(
  {
    useCase: { type: String, enum: AI_USE_CASE_LIST, required: true, index: true },
    /** Internal correlation only — never sent to the provider. */
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', default: null, index: true },
    consultationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', default: null, index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    promptVersion: { type: String, default: 'v1' },
    inputManifest: { type: mongoose.Schema.Types.Mixed, required: true },
    fieldsRemoved: { type: [String], default: [] },
    outputHash: { type: String, default: null },
    output: { type: mongoose.Schema.Types.Mixed, default: null },
    status: { type: String, enum: AI_RUN_STATUS_LIST, required: true, index: true },
    errorMessage: { type: String, default: null },
    latencyMs: { type: Number, default: null },
    estimatedCostUsd: { type: Number, default: 0 },
    disposition: { type: String, enum: AI_DISPOSITION_LIST, default: AI_DISPOSITION.PENDING, index: true },
    dispositionedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dispositionedAt: { type: Date, default: null },
    editedOutput: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, collection: 'ai_runs' }
);

aiRunSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    useCase: this.useCase,
    patientId: this.patientId ? this.patientId.toString() : null,
    consultationId: this.consultationId ? this.consultationId.toString() : null,
    requestedBy: this.requestedBy.toString(),
    provider: this.provider,
    model: this.model,
    promptVersion: this.promptVersion,
    inputManifest: this.inputManifest,
    fieldsRemoved: this.fieldsRemoved,
    output: this.output,
    status: this.status,
    errorMessage: this.errorMessage,
    latencyMs: this.latencyMs,
    estimatedCostUsd: this.estimatedCostUsd,
    disposition: this.disposition,
    dispositionedBy: this.dispositionedBy ? this.dispositionedBy.toString() : null,
    dispositionedAt: this.dispositionedAt,
    editedOutput: this.editedOutput,
    createdAt: this.createdAt,
  };
};

const AiRun = mongoose.model('AiRun', aiRunSchema);

export default AiRun;
