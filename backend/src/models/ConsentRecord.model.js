import mongoose from 'mongoose';
import {
  CONSENT_STATUS,
  CONSENT_STATUS_LIST,
  CONSENT_TYPE,
  CONSENT_TYPE_LIST,
} from '../enums/treatmentPlan.js';

/**
 * Consent records for a treatment plan.
 * e-sign is a placeholder (signatureData / signedAt) — no real PKI.
 */
const consentRecordSchema = new mongoose.Schema(
  {
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
    consentType: {
      type: String,
      enum: CONSENT_TYPE_LIST,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: CONSENT_STATUS_LIST,
      default: CONSENT_STATUS.PENDING,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: null },
    /** Placeholder for e-sign payload (base64 / typed name) */
    signatureData: { type: String, default: null },
    signedAt: { type: Date, default: null },
    signedByName: { type: String, default: null },
    witnessName: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    collection: 'consent_records',
  }
);

consentRecordSchema.index({ treatmentPlanId: 1, consentType: 1 });

consentRecordSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    treatmentPlanId: this.treatmentPlanId.toString(),
    patientId: this.patientId.toString(),
    consentType: this.consentType,
    status: this.status,
    title: this.title,
    body: this.body,
    signatureData: this.signatureData,
    signedAt: this.signedAt,
    signedByName: this.signedByName,
    witnessName: this.witnessName,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    ...extra,
  };
};

const ConsentRecord = mongoose.model('ConsentRecord', consentRecordSchema);

export { CONSENT_TYPE };
export default ConsentRecord;
