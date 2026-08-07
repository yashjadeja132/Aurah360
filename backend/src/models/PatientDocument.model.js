import mongoose from 'mongoose';
import { DOCUMENT_CATEGORY_LIST } from '../enums/patient.js';
import {
  DOCUMENT_REVIEW_STATE,
  DOCUMENT_REVIEW_STATE_LIST,
  DOCUMENT_SOURCE_LIST,
  PATIENT_VISIBILITY,
  PATIENT_VISIBILITY_LIST,
  SCAN_STATE,
  SCAN_STATE_LIST,
} from '../enums/patient.js';

const patientDocumentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: DOCUMENT_CATEGORY_LIST,
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    /** DOC-001 — original clinical/report date, not upload date; mandatory and searchable. */
    clinicalDate: { type: Date, required: true, index: true },
    source: { type: String, enum: DOCUMENT_SOURCE_LIST, default: 'PATIENT' },
    relatedVisitId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    originalName: { type: String, required: true },
    storageKey: { type: String, required: true },
    mimeType: { type: String, default: null },
    size: { type: Number, default: 0 },
    /** DOC-003 — SHA-256 of the original bytes; original file is immutable after upload. */
    checksum: { type: String, default: null },
    scanState: { type: String, enum: SCAN_STATE_LIST, default: SCAN_STATE.PENDING, index: true },
    reviewState: { type: String, enum: DOCUMENT_REVIEW_STATE_LIST, default: DOCUMENT_REVIEW_STATE.UNREVIEWED, index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewComment: { type: String, default: null },
    patientVisibility: { type: String, enum: PATIENT_VISIBILITY_LIST, default: PATIENT_VISIBILITY.HIDDEN, index: true },
    releasedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    releasedAt: { type: Date, default: null },
    version: { type: Number, default: 1 },
    supersedesDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientDocument', default: null },
    notes: { type: String, default: null },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    collection: 'patient_documents',
  }
);

patientDocumentSchema.index({ patientId: 1, clinicalDate: -1 });
patientDocumentSchema.index({ title: 'text', originalName: 'text' });

patientDocumentSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    patientId: this.patientId.toString(),
    category: this.category,
    title: this.title,
    clinicalDate: this.clinicalDate,
    source: this.source,
    relatedVisitId: this.relatedVisitId ? this.relatedVisitId.toString() : null,
    branchId: this.branchId ? this.branchId.toString() : null,
    originalName: this.originalName,
    storageKey: this.storageKey,
    mimeType: this.mimeType,
    size: this.size,
    checksum: this.checksum,
    scanState: this.scanState,
    reviewState: this.reviewState,
    reviewedBy: this.reviewedBy ? this.reviewedBy.toString() : null,
    reviewedAt: this.reviewedAt,
    reviewComment: this.reviewComment,
    patientVisibility: this.patientVisibility,
    releasedBy: this.releasedBy ? this.releasedBy.toString() : null,
    releasedAt: this.releasedAt,
    version: this.version,
    notes: this.notes,
    uploadedBy: this.uploadedBy ? this.uploadedBy.toString() : null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    /** Signed short-lived access — never a public/static path (DOC-003). */
    url: `/api/v1/files/documents/${this._id.toString()}`,
    accessUrl: `/api/v1/files/documents/${this._id.toString()}`,
  };
};

const PatientDocument = mongoose.model('PatientDocument', patientDocumentSchema);

export default PatientDocument;
