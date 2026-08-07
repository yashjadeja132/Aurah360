import mongoose from 'mongoose';
import { AI_USE_CASE_LIST } from '../enums/ai.js';

/** Per-use-case kill switch (AIG-001, §16.11) — immediate fallback to normal manual workflow. */
const aiFeatureFlagSchema = new mongoose.Schema(
  {
    useCase: { type: String, enum: AI_USE_CASE_LIST, required: true, unique: true },
    enabled: { type: Boolean, default: true },
    disabledReason: { type: String, default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'ai_feature_flags' }
);

aiFeatureFlagSchema.methods.toSafeObject = function toSafeObject() {
  return {
    useCase: this.useCase,
    enabled: this.enabled,
    disabledReason: this.disabledReason,
    updatedAt: this.updatedAt,
  };
};

const AiFeatureFlag = mongoose.model('AiFeatureFlag', aiFeatureFlagSchema);

export default AiFeatureFlag;
