import crypto from 'crypto';
import ApiError from '../libs/ApiError.js';
import PatientRepository from '../repositories/PatientRepository.js';
import PatientDocumentRepository from '../repositories/PatientDocumentRepository.js';
import PatientTimelineService from './PatientTimelineService.js';
import AuditService from './AuditService.js';
import StorageFactory from '../storage/StorageFactory.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { TIMELINE_EVENT, SCAN_STATE, DOCUMENT_REVIEW_STATE, PATIENT_VISIBILITY } from '../enums/patient.js';

/** Executable/script extensions are always quarantined — a real AV/ClamAV scan slots in behind this. */
const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|sh|js|jar|msi|scr|com|vbs|ps1)$/i;
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf'];

/**
 * Reusable document service — EMR/future modules can reuse upload/list/delete.
 */
class PatientDocumentService {
  constructor() {
    this.patientRepository = new PatientRepository();
    this.documentRepository = new PatientDocumentRepository();
    this.timelineService = new PatientTimelineService();
    this.auditService = new AuditService();
    this.storage = StorageFactory.create();
  }

  async #assertPatient(patientId) {
    const patient = await this.patientRepository.findByIdNotDeleted(patientId);
    if (!patient) throw ApiError.notFound('Patient not found');
    return patient;
  }

  async list(patientId) {
    await this.#assertPatient(patientId);
    const docs = await this.documentRepository.findByPatient(patientId);
    return docs.map((d) => d.toSafeObject());
  }

  async upload(patientId, { file, category, title, notes, clinicalDate, source, relatedVisitId, branchId }, actorId, req = null) {
    await this.#assertPatient(patientId);
    if (!file?.buffer) throw ApiError.badRequest('File is required');
    if (!clinicalDate) throw ApiError.badRequest('Clinical/report date is required (DOC-001)');

    // DOC-002/IMG — malware/type screening (allowlisted MIME + blocked extensions before storage).
    const isBlockedExt = BLOCKED_EXTENSIONS.test(file.originalname || '');
    const isAllowedMime = ALLOWED_MIME_PREFIXES.some((p) => (file.mimetype || '').startsWith(p));
    const scanState = isBlockedExt || !isAllowedMime ? SCAN_STATE.QUARANTINED : SCAN_STATE.CLEAN;
    if (scanState === SCAN_STATE.QUARANTINED) {
      throw ApiError.badRequest(
        'File type is not allowed. Only PDF and image formats are accepted.',
        null,
        'FILE_TYPE_REJECTED'
      );
    }

    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    // User-supplied filename never becomes the storage path (§16.7) — a random name does.
    const safeName = `${Date.now()}-${crypto.randomUUID()}${extOf(file.originalname)}`;
    const saved = await this.storage.save(file.buffer, {
      folder: `patients/${patientId}`,
      filename: safeName,
      mimeType: file.mimetype,
    });

    const doc = await this.documentRepository.create({
      patientId,
      category,
      title: title || file.originalname,
      clinicalDate,
      source: source || 'PATIENT',
      relatedVisitId: relatedVisitId || null,
      branchId: branchId || null,
      originalName: file.originalname,
      storageKey: saved.key,
      mimeType: saved.mimeType,
      size: saved.size,
      checksum,
      scanState,
      reviewState: DOCUMENT_REVIEW_STATE.UNREVIEWED,
      patientVisibility: PATIENT_VISIBILITY.HIDDEN,
      notes: notes || null,
      uploadedBy: actorId,
    });

    await this.timelineService.addEvent(patientId, {
      eventType: TIMELINE_EVENT.DOCUMENT_UPLOADED,
      title: 'Document uploaded',
      description: doc.title,
      metadata: { documentId: doc._id.toString(), category },
      actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.PATIENT_DOCUMENT_UPLOADED, {
      actorId,
      metadata: { patientId, documentId: doc._id.toString() },
      req,
    });

    return doc.toSafeObject();
  }

  async rename(patientId, documentId, title, actorId) {
    await this.#assertPatient(patientId);
    const doc = await this.documentRepository.findByIdNotDeleted(documentId);
    if (!doc || doc.patientId.toString() !== patientId.toString()) {
      throw ApiError.notFound('Document not found');
    }

    const updated = await this.documentRepository.updateById(documentId, { title });
    return updated.toSafeObject();
  }

  async softDelete(patientId, documentId, actorId, req = null) {
    await this.#assertPatient(patientId);
    const doc = await this.documentRepository.findByIdNotDeleted(documentId);
    if (!doc || doc.patientId.toString() !== patientId.toString()) {
      throw ApiError.notFound('Document not found');
    }

    await this.documentRepository.updateById(documentId, {
      deletedAt: new Date(),
      deletedBy: actorId,
    });

    await this.timelineService.addEvent(patientId, {
      eventType: TIMELINE_EVENT.DOCUMENT_DELETED,
      title: 'Document deleted',
      description: doc.title,
      metadata: { documentId },
      actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.PATIENT_DOCUMENT_DELETED, {
      actorId,
      metadata: { patientId, documentId },
      req,
    });

    return true;
  }

  async getByIdForPatient(patientId, documentId) {
    const doc = await this.documentRepository.findByIdNotDeleted(documentId);
    if (!doc || doc.patientId.toString() !== patientId.toString()) {
      throw ApiError.notFound('Document not found');
    }
    return doc;
  }

  /** DOC review workflow — reception upload → doctor review → patient release. */
  async review(patientId, documentId, { reviewState, reviewComment }, actorId, req = null) {
    const doc = await this.getByIdForPatient(patientId, documentId);
    doc.reviewState = reviewState;
    doc.reviewComment = reviewComment || null;
    doc.reviewedBy = actorId;
    doc.reviewedAt = new Date();
    await doc.save();
    await this.auditService.record(AUDIT_ACTIONS.DOCUMENT_REVIEWED, {
      actorId,
      metadata: { patientId, documentId, reviewState },
      req,
    });
    return doc.toSafeObject();
  }

  /** Explicit doctor/clinic release — hidden by default (§7.1 patient visibility). */
  async release(patientId, documentId, { visibility }, actorId, req = null) {
    const doc = await this.getByIdForPatient(patientId, documentId);
    doc.patientVisibility = visibility;
    doc.releasedBy = actorId;
    doc.releasedAt = new Date();
    await doc.save();
    await this.auditService.record(AUDIT_ACTIONS.DOCUMENT_RELEASED, {
      actorId,
      metadata: { patientId, documentId, visibility },
      req,
    });
    return doc.toSafeObject();
  }
}

function extOf(filename = '') {
  const match = /\.[a-zA-Z0-9]+$/.exec(filename);
  return match ? match[0].toLowerCase() : '';
}

export default PatientDocumentService;
