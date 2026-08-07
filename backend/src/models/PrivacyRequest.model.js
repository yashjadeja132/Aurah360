import mongoose from 'mongoose';
import { PRIVACY_REQUEST_TYPE_LIST, PRIVACY_REQUEST_STATUS, PRIVACY_REQUEST_STATUS_LIST } from '../enums/privacy.js';

/** Data-subject rights case (§16.5, PRV-002) — access/correction/erasure/portability/grievance/opt-out. */
const privacyRequestSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    type: { type: String, enum: PRIVACY_REQUEST_TYPE_LIST, required: true, index: true },
    status: { type: String, enum: PRIVACY_REQUEST_STATUS_LIST, default: PRIVACY_REQUEST_STATUS.OPEN, index: true },
    description: { type: String, default: null },
    dueDate: { type: Date, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    identityVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    identityVerifiedAt: { type: Date, default: null },
    resolutionNotes: { type: String, default: null },
    denialReason: { type: String, default: null },
    exceptionReasoned: { type: String, default: null }, // clinical-integrity/legal-hold exception, if any
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, collection: 'privacy_requests' }
);

privacyRequestSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    patientId: this.patientId.toString(),
    type: this.type,
    status: this.status,
    description: this.description,
    dueDate: this.dueDate,
    ownerId: this.ownerId ? this.ownerId.toString() : null,
    identityVerifiedBy: this.identityVerifiedBy ? this.identityVerifiedBy.toString() : null,
    identityVerifiedAt: this.identityVerifiedAt,
    resolutionNotes: this.resolutionNotes,
    denialReason: this.denialReason,
    exceptionReasoned: this.exceptionReasoned,
    resolvedBy: this.resolvedBy ? this.resolvedBy.toString() : null,
    resolvedAt: this.resolvedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const PrivacyRequest = mongoose.model('PrivacyRequest', privacyRequestSchema);

export default PrivacyRequest;
