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

  /** Staff view — every document on the record, including the ones not released to the patient. */
  async list(patientId) {
    await this.#assertPatient(patientId);
    const docs = await this.documentRepository.findByPatient(patientId);
    return docs.map((d) => d.toSafeObject());
  }

  /**
   * Patient-portal view. Documents default to HIDDEN and are released explicitly (see `release`),
   * but the portal was serving `list()` — so a patient's own app listed every unreleased upload
   * with its title, category and notes. `GET /files/patient/documents/:id` refused the BYTES of a
   * hidden document, which made the leak metadata-only and easy to miss; the fix belongs here, at
   * the listing, so no portal caller can enumerate what it must not see.
   */
  async listPatientVisible(patientId) {
    const docs = await this.list(patientId);
    return docs.filter((d) => d.patientVisibility !== PATIENT_VISIBILITY.HIDDEN);
  }

  async upload(patientId, { file, category, title, notes, clinicalDate, source, relatedVisitId, branchId, supersedesDocumentId }, actorId, req = null) {
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

    /**
     * DOC-002 versioning. `version` and `supersedesDocumentId` existed on the model with zero write
     * sites, so re-uploading a corrected report produced two unrelated documents and staff had no
     * way to tell which one was current — the model claimed versioning the service never performed.
     *
     * A replacement never mutates or deletes the original: the superseded document stays exactly as
     * it was (DOC-003 immutability) and the new row simply points back at it, one higher. The
     * predecessor must belong to the SAME PATIENT — otherwise a caller could chain one patient's
     * record onto another's.
     */
    let version = 1;
    let supersedes = null;
    if (supersedesDocumentId) {
      const previous = await this.documentRepository.findByIdNotDeleted(supersedesDocumentId);
      if (!previous || previous.patientId.toString() !== patientId.toString()) {
        throw ApiError.badRequest('Superseded document not found for this patient');
      }
      supersedes = previous._id;
      version = (previous.version || 1) + 1;
    }

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
      version,
      supersedesDocumentId: supersedes,
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

  /**
   * DOC-003 — a metadata correction must be auditable. This used to overwrite the title with no
   * audit row at all, so a report could be retitled after the fact leaving no trace of what it was
   * called before or who changed it. The previous title is recorded in the audit entry, because an
   * audit that says only "title changed" cannot answer the question anyone actually asks.
   */
  async rename(patientId, documentId, title, actorId, reason = null, req = null) {
    await this.#assertPatient(patientId);
    const doc = await this.documentRepository.findByIdNotDeleted(documentId);
    if (!doc || doc.patientId.toString() !== patientId.toString()) {
      throw ApiError.notFound('Document not found');
    }

    const previousTitle = doc.title;
    const updated = await this.documentRepository.updateById(documentId, { title });

    await this.auditService.record(AUDIT_ACTIONS.PATIENT_DOCUMENT_RENAMED, {
      actorId,
      metadata: { patientId, documentId, previousTitle, newTitle: title, reason: reason || null },
      req,
    });

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
