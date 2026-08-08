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
    /** Refinement chain — set when this run re-ran an earlier run with recorded patient answers. */
    parentRunId: { type: mongoose.Schema.Types.ObjectId, ref: 'AiRun', default: null, index: true },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    /**
     * The identity of the prompt that ACTUALLY produced this run: `<label>@<8-char content hash>`.
     * Deliberately has no default — a run recorded without a prompt (kill switch, budget refusal)
     * must read as null, not as a fabricated version. A stale `default: 'v1'` here previously made
     * every row claim v1 regardless of the prompt used, which made provenance unusable.
     */
    promptVersion: { type: String, default: null },
    inputManifest: { type: mongoose.Schema.Types.Mixed, required: true },
    fieldsRemoved: { type: [String], default: [] },
    outputHash: { type: String, default: null },
    output: { type: mongoose.Schema.Types.Mixed, default: null },
    status: { type: String, enum: AI_RUN_STATUS_LIST, required: true, index: true },
    errorMessage: { type: String, default: null },
    latencyMs: { type: Number, default: null },
    /** Provider-reported token counts this run was billed on (provider-neutral shape). */
    usage: {
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
      cacheCreationInputTokens: { type: Number, default: 0 },
      cacheReadInputTokens: { type: Number, default: 0 },
    },
    /** Derived from `usage` via AiCostEstimator. Hardcoded rates — an estimate, never an invoice. */
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
    parentRunId: this.parentRunId ? this.parentRunId.toString() : null,
    provider: this.provider,
    model: this.model,
    promptVersion: this.promptVersion,
    inputManifest: this.inputManifest,
    fieldsRemoved: this.fieldsRemoved,
    output: this.output,
    status: this.status,
    errorMessage: this.errorMessage,
    latencyMs: this.latencyMs,
    usage: {
      inputTokens: this.usage?.inputTokens || 0,
      outputTokens: this.usage?.outputTokens || 0,
      cacheCreationInputTokens: this.usage?.cacheCreationInputTokens || 0,
      cacheReadInputTokens: this.usage?.cacheReadInputTokens || 0,
    },
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
