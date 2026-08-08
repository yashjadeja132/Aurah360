import path from 'path';
import ApiError from '../libs/ApiError.js';
import asyncHandler from '../libs/asyncHandler.js';
import config from '../config/index.js';
import StorageFactory from '../storage/StorageFactory.js';
import { generateFileToken, verifyFileToken } from '../storage/LocalStorage.js';
import PatientDocumentRepository from '../repositories/PatientDocumentRepository.js';
import { ClinicalPhotoRepository } from '../repositories/ConsultationClinicalRepository.js';
import { hasAnyPermission } from '../helpers/permission.helper.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { ROLES } from '../constants/roles.js';
import AuditService from '../services/AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { PATIENT_VISIBILITY, SCAN_STATE } from '../enums/patient.js';
import { assertPatientInScope } from '../helpers/patientScope.helper.js';

const storage = StorageFactory.create();
const documentRepository = new PatientDocumentRepository();
const photoRepository = new ClinicalPhotoRepository();
const auditService = new AuditService();

/**
 * Auth-gated file serving — replaces the old public `express.static('/uploads')` mount
 * (RC1 security finding B1). Every read is permission-checked and audited; there is no
 * public object path. `authenticate` middleware runs ahead of this on the route.
 *
 * SEC-030 closes three defects here. This is the one place raw bytes leave the system, so it is
 * the one place a scoping gap is unrecoverable:
 *
 *  1. ROW SCOPE. Access used to be permission-only: any holder of `patients.view` could fetch any
 *     document or clinical-photo id in the organisation, in any branch, for a patient they had
 *     never met. Staff reads now additionally require the file's patient to be connected to the
 *     caller's branch (`assertPatientInScope` — registration branch ∪ consultation branches ∪
 *     appointment branches, so a patient treated away from their home branch stays readable
 *     there). Out of scope answers 404, never 403: a 403 would confirm the id exists.
 *  2. DOWNLOAD ≠ VIEW. One permission used to cover both. Fetching to render inline is unchanged;
 *     asking for `?download=1` (which is what now sets `Content-Disposition: attachment`) needs
 *     `patients.documents.download` or one of the document-management grants that already implied
 *     it. Nothing that worked before breaks — the download flag is new, so every existing caller
 *     lands on the unchanged view path.
 *  3. PORTAL AUDIT. Patient-portal file reads served bytes with no audit record at all, so a
 *     patient's own downloads were invisible to an auditor while staff downloads were logged.
 *     They are now recorded with the same action, tagged `channel: 'PATIENT_PORTAL'`.
 */
class FileAccessController {
  #canViewClinical(req) {
    if (req.auth?.role === ROLES.OWNER) return true;
    return hasAnyPermission(req.auth?.permissions || [], [
      PERMISSIONS.PATIENTS_DOCUMENTS,
      PERMISSIONS.CLINICAL_VIEW,
      PERMISSIONS.CLINICAL_ALL,
      PERMISSIONS.PATIENTS_VIEW,
      PERMISSIONS.PATIENTS_ALL,
    ]);
  }

  /**
   * Resolves the request's authorization for a given file: an authenticated session with
   * clinical-view permission, OR (additive — Task #24) a valid `?token=` signed for this
   * exact file id. Session auth is checked first and is never weakened by the token path.
   */
  #authorizeFileAccess(req, fileId) {
    if (req.auth) {
      if (!this.#canViewClinical(req)) throw ApiError.forbidden('Insufficient permissions');
      return { viaToken: false };
    }

    const token = req.query?.token;
    if (token) {
      if (!verifyFileToken(fileId, token)) {
        throw ApiError.forbidden('Invalid or expired file token');
      }
      return { viaToken: true };
    }

    throw ApiError.unauthorized('Access token required');
  }

  /** True when the caller explicitly asked for a copy rather than an inline render. */
  #isDownloadRequest(req) {
    const flag = String(req.query?.download ?? '').toLowerCase();
    const disposition = String(req.query?.disposition ?? '').toLowerCase();
    return flag === '1' || flag === 'true' || disposition === 'attachment';
  }

  /**
   * Download gate — deliberately ADDITIVE to the permissions that already implied a right to take
   * a copy (document management / patients.* / clinical.*), so no role that could legitimately
   * download before loses the ability. It bites only on view-only grants (NURSE, TECHNICIAN:
   * `patients.view` + `clinical.view`), which is the separation that was missing.
   */
  #assertCanDownload(req, viaToken) {
    if (viaToken) {
      // A signed link proves the file, not the bearer's role — there is no session to check a
      // download grant against, so signed links stay view-only.
      throw ApiError.forbidden(
        'A signed file link may be viewed but not downloaded; sign in to download this file.',
        'FILE_DOWNLOAD_NOT_PERMITTED'
      );
    }
    if (req.auth?.role === ROLES.OWNER) return;
    const permitted = hasAnyPermission(req.auth?.permissions || [], [
      PERMISSIONS.PATIENTS_DOCUMENTS_DOWNLOAD,
      PERMISSIONS.PATIENTS_DOCUMENTS,
      PERMISSIONS.PATIENTS_ALL,
      PERMISSIONS.CLINICAL_ALL,
    ]);
    if (!permitted) {
      throw ApiError.forbidden(
        'You may view this file but not download a copy of it.',
        'FILE_DOWNLOAD_NOT_PERMITTED'
      );
    }
  }

  /** `Content-Disposition` for the byte response — attachment only on an authorized download. */
  #dispositionHeader(isDownload, originalName) {
    const safeName = String(originalName || 'file').replace(/[^\w.\-]+/g, '_');
    return `${isDownload ? 'attachment' : 'inline'}; filename="${safeName}"`;
  }

  /**
   * Row scope for a staff read. Skipped for the signed-token path (the token was minted by a
   * session that had already passed this check for this exact file id) and for patient sessions.
   */
  async #assertStaffScope(req, patientId, notFoundMessage) {
    if (!req.auth) return;
    await assertPatientInScope(req, patientId, notFoundMessage);
  }

  /**
   * Malware-scan gate (Task #23) — only CLEAN files are servable. PENDING is a soft/retryable
   * state (scan just hasn't finished); QUARANTINED/REJECTED are a hard block that gets audited.
   * Returns null when clean/servable, otherwise a response the caller should send as-is.
   */
  async #scanGate(res, scanState, { fileId, patientId, req, kind }) {
    if (scanState === SCAN_STATE.CLEAN) return null;

    if (scanState === SCAN_STATE.PENDING) {
      res.status(202).json({
        message: 'This file is still being scanned for malware. Please try again shortly.',
        scanState,
      });
      return res;
    }

    // QUARANTINED / REJECTED (or any unrecognized state) — hard block, audited.
    await auditService.record(AUDIT_ACTIONS.SCANNED_FILE_ACCESS_BLOCKED, {
      actorId: req.auth?.userId || null,
      metadata: { [kind === 'photo' ? 'photoId' : 'documentId']: fileId, patientId, scanState },
      req,
    });
    throw ApiError.forbidden('This file is blocked pending security review');
  }

  document = asyncHandler(async (req, res) => {
    const doc = await documentRepository.findByIdNotDeleted(req.params.id);
    if (!doc) throw ApiError.notFound('Document not found');

    const fileId = doc._id.toString();
    const { viaToken } = this.#authorizeFileAccess(req, fileId);
    await this.#assertStaffScope(req, doc.patientId, 'Document not found');

    const isDownload = this.#isDownloadRequest(req);
    if (isDownload) this.#assertCanDownload(req, viaToken);

    const gated = await this.#scanGate(res, doc.scanState, {
      fileId,
      patientId: doc.patientId.toString(),
      req,
      kind: 'document',
    });
    if (gated) return gated;

    await auditService.record(AUDIT_ACTIONS.PATIENT_DOCUMENT_DOWNLOADED, {
      actorId: req.auth?.userId || null,
      metadata: {
        documentId: fileId,
        patientId: doc.patientId.toString(),
        viaToken,
        mode: isDownload ? 'DOWNLOAD' : 'VIEW',
      },
      req,
    });

    const absolutePath = await storage.getAbsolutePath(doc.storageKey);
    return res.sendFile(path.resolve(absolutePath), {
      headers: {
        'Content-Type': doc.mimeType || 'application/octet-stream',
        'Content-Disposition': this.#dispositionHeader(isDownload, doc.originalName),
      },
    });
  });

  /** Issues a short-lived signed token for `document` (Task #24) — still requires a valid session. */
  documentToken = asyncHandler(async (req, res) => {
    const doc = await documentRepository.findByIdNotDeleted(req.params.id);
    if (!doc) throw ApiError.notFound('Document not found');
    if (!this.#canViewClinical(req)) throw ApiError.forbidden('Insufficient permissions');
    await this.#assertStaffScope(req, doc.patientId, 'Document not found');

    const { token, expiresAt } = generateFileToken(doc._id.toString());
    return res.json({ token, expiresAt });
  });

  photo = asyncHandler(async (req, res) => {
    const photo = await photoRepository.findByIdNotDeleted(req.params.id);
    if (!photo) throw ApiError.notFound('Photo not found');

    const fileId = photo._id.toString();
    const { viaToken } = this.#authorizeFileAccess(req, fileId);
    await this.#assertStaffScope(req, photo.patientId, 'Photo not found');

    const isDownload = this.#isDownloadRequest(req);
    if (isDownload) this.#assertCanDownload(req, viaToken);

    const gated = await this.#scanGate(res, photo.scanState, {
      fileId,
      patientId: photo.patientId.toString(),
      req,
      kind: 'photo',
    });
    if (gated) return gated;

    // IMG-003/PRV-001 — defence in depth behind the upload-time capture policy: photo BYTES are
    // never served for a row whose consent was never verified. Every capture path now sets this
    // from the real ConsentGrant log (ClinicalPhotoPolicyService), so an unverified row means the
    // image predates/bypassed the policy and must not be released.
    if (photo.consentVerified !== true) {
      await auditService.record(AUDIT_ACTIONS.CLINICAL_PHOTO_CONSENT_MISSING, {
        actorId: req.auth?.userId || null,
        metadata: { photoId: fileId, patientId: photo.patientId.toString(), stage: 'file_access' },
        req,
      });
      throw ApiError.forbidden(
        'Photography consent is not verified for this image, so it cannot be viewed or downloaded.',
        'PHOTOGRAPHY_CONSENT_NOT_VERIFIED'
      );
    }

    await auditService.record(AUDIT_ACTIONS.PATIENT_DOCUMENT_DOWNLOADED, {
      actorId: req.auth?.userId || null,
      metadata: {
        photoId: fileId,
        patientId: photo.patientId.toString(),
        viaToken,
        mode: isDownload ? 'DOWNLOAD' : 'VIEW',
      },
      req,
    });

    const absolutePath = await storage.getAbsolutePath(photo.storageKey);
    return res.sendFile(path.resolve(absolutePath), {
      headers: {
        'Content-Type': photo.mimeType || 'application/octet-stream',
        'Content-Disposition': this.#dispositionHeader(isDownload, photo.originalName),
      },
    });
  });

  /** Issues a short-lived signed token for `photo` (Task #24) — still requires a valid session. */
  photoToken = asyncHandler(async (req, res) => {
    const photo = await photoRepository.findByIdNotDeleted(req.params.id);
    if (!photo) throw ApiError.notFound('Photo not found');
    if (!this.#canViewClinical(req)) throw ApiError.forbidden('Insufficient permissions');
    await this.#assertStaffScope(req, photo.patientId, 'Photo not found');

    const { token, expiresAt } = generateFileToken(photo._id.toString());
    return res.json({ token, expiresAt });
  });

  /**
   * Resolves the request's authorization for a given patient-portal file: an authenticated
   * patient session that owns the record, OR (Task #46 — mirrors staff's Task #24) a valid
   * `?token=` signed for this exact file id. The token path is only reachable for files the
   * patient already owned at the moment the token was issued (see `patientDocumentToken` /
   * `patientPhotoToken` below), so it does not need to re-check ownership here.
   */
  #authorizePatientFileAccess(req, fileId, ownerPatientId) {
    if (req.patientAuth) {
      if (ownerPatientId !== req.patientAuth.patientId) throw ApiError.forbidden();
      return { viaToken: false };
    }

    const token = req.query?.token;
    if (token) {
      if (!verifyFileToken(fileId, token)) {
        throw ApiError.forbidden('Invalid or expired file token');
      }
      return { viaToken: true };
    }

    throw ApiError.unauthorized('Access token required');
  }

  patientDocument = asyncHandler(async (req, res) => {
    const doc = await documentRepository.findByIdNotDeleted(req.params.id);
    if (!doc) throw ApiError.notFound('Document not found');

    const fileId = doc._id.toString();
    const ownerPatientId = doc.patientId.toString();
    const { viaToken } = this.#authorizePatientFileAccess(req, fileId, ownerPatientId);
    if (doc.patientVisibility === PATIENT_VISIBILITY.HIDDEN) throw ApiError.forbidden('Not released');

    const gated = await this.#scanGate(res, doc.scanState, {
      fileId,
      patientId: doc.patientId.toString(),
      req,
      kind: 'document',
    });
    if (gated) return gated;

    // SEC-030 — portal reads were the only byte-serving path with no audit record at all.
    // actorId is null because the reader is a patient, not a staff User; the patient is
    // identified by `patientId` and the channel tag.
    await auditService.record(AUDIT_ACTIONS.PATIENT_DOCUMENT_DOWNLOADED, {
      actorId: null,
      metadata: { documentId: fileId, patientId: ownerPatientId, viaToken, channel: 'PATIENT_PORTAL' },
      req,
    });

    const absolutePath = await storage.getAbsolutePath(doc.storageKey);
    return res.sendFile(path.resolve(absolutePath), {
      headers: { 'Content-Type': doc.mimeType || 'application/octet-stream' },
    });
  });

  /**
   * Issues a short-lived signed token for a patient's own document (Task #46) — mirrors
   * `documentToken` on the staff side. Requires a valid patient session; the resulting token
   * can then be used on `GET /files/patient/documents/:id?token=...` without that session.
   */
  patientDocumentToken = asyncHandler(async (req, res) => {
    const doc = await documentRepository.findByIdNotDeleted(req.params.id);
    if (!doc) throw ApiError.notFound('Document not found');
    if (doc.patientId.toString() !== req.patientAuth.patientId) throw ApiError.forbidden();
    if (doc.patientVisibility === PATIENT_VISIBILITY.HIDDEN) throw ApiError.forbidden('Not released');

    const { token, expiresAt } = generateFileToken(doc._id.toString());
    return res.json({ token, expiresAt });
  });

  patientPhoto = asyncHandler(async (req, res) => {
    const photo = await photoRepository.findByIdNotDeleted(req.params.id);
    if (!photo) throw ApiError.notFound('Photo not found');

    const photoFileId = photo._id.toString();
    const photoOwnerPatientId = photo.patientId.toString();
    const { viaToken } = this.#authorizePatientFileAccess(req, photoFileId, photoOwnerPatientId);
    if (photo.patientVisibility === PATIENT_VISIBILITY.HIDDEN) throw ApiError.forbidden('Not released');

    const photoGated = await this.#scanGate(res, photo.scanState, {
      fileId: photoFileId,
      patientId: photo.patientId.toString(),
      req,
      kind: 'photo',
    });
    if (photoGated) return photoGated;

    // SEC-030 — see `patientDocument`: portal photo reads were likewise unaudited.
    await auditService.record(AUDIT_ACTIONS.PATIENT_DOCUMENT_DOWNLOADED, {
      actorId: null,
      metadata: {
        photoId: photoFileId,
        patientId: photoOwnerPatientId,
        viaToken,
        channel: 'PATIENT_PORTAL',
      },
      req,
    });

    const absolutePath = await storage.getAbsolutePath(photo.storageKey);
    return res.sendFile(path.resolve(absolutePath), {
      headers: { 'Content-Type': photo.mimeType || 'application/octet-stream' },
    });
  });

  /** Issues a short-lived signed token for a patient's own clinical photo (Task #46). */
  patientPhotoToken = asyncHandler(async (req, res) => {
    const photo = await photoRepository.findByIdNotDeleted(req.params.id);
    if (!photo) throw ApiError.notFound('Photo not found');
    if (photo.patientId.toString() !== req.patientAuth.patientId) throw ApiError.forbidden();
    if (photo.patientVisibility === PATIENT_VISIBILITY.HIDDEN) throw ApiError.forbidden('Not released');

    const { token, expiresAt } = generateFileToken(photo._id.toString());
    return res.json({ token, expiresAt });
  });
}

export default FileAccessController;
