import mongoose from 'mongoose';
import { PHOTO_TYPE, PHOTO_TYPE_LIST } from '../enums/consultation.js';
import {
  PHOTO_LATERALITY_LIST,
  PATIENT_VISIBILITY,
  PATIENT_VISIBILITY_LIST,
  SCAN_STATE,
  SCAN_STATE_LIST,
} from '../enums/patient.js';

const clinicalPhotoSchema = new mongoose.Schema(
  {
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
    photoType: {
      type: String,
      enum: PHOTO_TYPE_LIST,
      default: PHOTO_TYPE.BEFORE,
      index: true,
    },
    title: { type: String, default: null },
    bodyRegion: { type: String, default: null },
    /** IMG-002 governance metadata */
    laterality: { type: String, enum: PHOTO_LATERALITY_LIST, default: 'NOT_APPLICABLE' },
    angle: { type: String, default: null },
    lighting: { type: String, default: null },
    photographerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    captureDevice: { type: String, default: null },
    /**
     * IMG-002 before/after pairing. Set at capture and now READ when listing, so the comparison
     * view can resolve a photo's counterpart instead of asking the doctor to re-find it by eye.
     */
    pairedPhotoId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClinicalPhoto', default: null },
    /*
     * `isAnnotatedDerivative` and `originalPhotoId` (IMG-004) were removed. They had zero read and
     * zero write sites anywhere in the codebase — non-destructive annotation was never built, and
     * carrying its schema implied a capability that does not exist. Re-add them together with the
     * annotation endpoint if that feature is picked up; a field with no behaviour behind it is a
     * claim the system cannot honour.
     */
    /** IMG-005 — release/export are separate, explicit permissions; hidden by default. */
    patientVisibility: { type: String, enum: PATIENT_VISIBILITY_LIST, default: PATIENT_VISIBILITY.HIDDEN },
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    releasedAt: { type: Date, default: null },
    marketingConsentVerified: { type: Boolean, default: false },
    storageKey: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, default: null },
    size: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    /**
     * Malware-scan gate (mirrors PatientDocument.scanState). No async AV pipeline exists yet
     * for clinical photos, so new uploads default to CLEAN to preserve current behaviour;
     * this only becomes meaningful once a scanning worker starts writing PENDING/QUARANTINED/REJECTED.
     */
    scanState: { type: String, enum: SCAN_STATE_LIST, default: SCAN_STATE.CLEAN, index: true },
    consentVerified: { type: Boolean, default: false },
    consentVerifiedAt: { type: Date, default: null },
    consentVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'clinical_photos',
  }
);

clinicalPhotoSchema.methods.toSafeObject = function toSafeObject(extra = {}) {
  return {
    id: this._id.toString(),
    consultationId: this.consultationId.toString(),
    patientId: this.patientId.toString(),
    photoType: this.photoType,
    title: this.title,
    bodyRegion: this.bodyRegion,
    laterality: this.laterality,
    angle: this.angle,
    lighting: this.lighting,
    photographerId: this.photographerId ? this.photographerId.toString() : null,
    captureDevice: this.captureDevice,
    pairedPhotoId: this.pairedPhotoId ? this.pairedPhotoId.toString() : null,
    patientVisibility: this.patientVisibility,
    releasedBy: this.releasedBy ? this.releasedBy.toString() : null,
    releasedAt: this.releasedAt,
    storageKey: this.storageKey,
    originalName: this.originalName,
    mimeType: this.mimeType,
    size: this.size,
    metadata: this.metadata || {},
    scanState: this.scanState,
    consentVerified: this.consentVerified,
    consentVerifiedAt: this.consentVerifiedAt,
    consentVerifiedBy: this.consentVerifiedBy ? this.consentVerifiedBy.toString() : null,
    uploadedBy: this.uploadedBy ? this.uploadedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    url: `/api/v1/files/photos/${this._id.toString()}`,
    accessUrl: `/api/v1/files/photos/${this._id.toString()}`,
    ...extra,
  };
};

const ClinicalPhoto = mongoose.model('ClinicalPhoto', clinicalPhotoSchema);

export default ClinicalPhoto;
