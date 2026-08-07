import mongoose from 'mongoose';
import { CONSENT_PURPOSE_LIST, CONSENT_STATE, CONSENT_STATE_LIST, CONSENT_METHOD_LIST } from '../enums/privacy.js';

/**
 * Append-only consent event log (§16.3, PRV-001). The current state for a purpose is the
 * most recent grant/withdrawal row — history is never edited or deleted, only appended.
 */
const consentGrantSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    purpose: { type: String, enum: CONSENT_PURPOSE_LIST, required: true, index: true },
    definitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ConsentDefinition', default: null },
    definitionVersion: { type: Number, default: null },
    language: { type: String, default: 'en' },
    state: { type: String, enum: CONSENT_STATE_LIST, required: true, default: CONSENT_STATE.GRANTED },
    method: { type: String, enum: CONSENT_METHOD_LIST, default: 'STAFF_ENTERED' },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    ipAddress: { type: String, default: null },
    deviceInfo: { type: String, default: null },
    reason: { type: String, default: null },
    recordedAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: true, collection: 'consent_grants' }
);

consentGrantSchema.index({ patientId: 1, purpose: 1, recordedAt: -1 });

consentGrantSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    patientId: this.patientId.toString(),
    purpose: this.purpose,
    definitionId: this.definitionId ? this.definitionId.toString() : null,
    definitionVersion: this.definitionVersion,
    language: this.language,
    state: this.state,
    method: this.method,
    actorId: this.actorId ? this.actorId.toString() : null,
    ipAddress: this.ipAddress,
    deviceInfo: this.deviceInfo,
    reason: this.reason,
    recordedAt: this.recordedAt,
    createdAt: this.createdAt,
  };
};

const ConsentGrant = mongoose.model('ConsentGrant', consentGrantSchema);

export default ConsentGrant;
