import mongoose from 'mongoose';
import { CONSENT_PURPOSE_LIST } from '../enums/privacy.js';

/**
 * A versioned consent/notice document (§16.3). Editing wording creates a new version;
 * old versions stay for audit — grants always reference the version shown to the patient.
 */
const consentDefinitionSchema = new mongoose.Schema(
  {
    purpose: { type: String, enum: CONSENT_PURPOSE_LIST, required: true, index: true },
    version: { type: Number, required: true, min: 1 },
    language: { type: String, default: 'en' },
    title: { type: String, required: true, trim: true },
    bodyText: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
    effectiveFrom: { type: Date, default: () => new Date() },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'consent_definitions' }
);

consentDefinitionSchema.index({ purpose: 1, language: 1, version: 1 }, { unique: true });

consentDefinitionSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    purpose: this.purpose,
    version: this.version,
    language: this.language,
    title: this.title,
    bodyText: this.bodyText,
    isActive: this.isActive,
    effectiveFrom: this.effectiveFrom,
    createdAt: this.createdAt,
  };
};

const ConsentDefinition = mongoose.model('ConsentDefinition', consentDefinitionSchema);

export default ConsentDefinition;
