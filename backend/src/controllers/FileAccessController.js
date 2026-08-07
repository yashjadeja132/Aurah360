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

const storage = StorageFactory.create();
const documentRepository = new PatientDocumentRepository();
const photoRepository = new ClinicalPhotoRepository();
const auditService = new AuditService();

/**
 * Auth-gated file serving — replaces the old public `express.static('/uploads')` mount
 * (RC1 security finding B1). Every read is permission-checked and audited; there is no
 * public object path. `authenticate` middleware runs ahead of this on the route.
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

    const gated = await this.#scanGate(res, doc.scanState, {
      fileId,
      patientId: doc.patientId.toString(),
      req,
      kind: 'document',
    });
    if (gated) return gated;

    await auditService.record(AUDIT_ACTIONS.PATIENT_DOCUMENT_DOWNLOADED, {
      actorId: req.auth?.userId || null,
      metadata: { documentId: fileId, patientId: doc.patientId.toString(), viaToken },
      req,
    });

    const absolutePath = await storage.getAbsolutePath(doc.storageKey);
    return res.sendFile(path.resolve(absolutePath), {
      headers: { 'Content-Type': doc.mimeType || 'application/octet-stream' },
    });
  });

  /** Issues a short-lived signed token for `document` (Task #24) — still requires a valid session. */
  documentToken = asyncHandler(async (req, res) => {
    const doc = await documentRepository.findByIdNotDeleted(req.params.id);
    if (!doc) throw ApiError.notFound('Document not found');
    if (!this.#canViewClinical(req)) throw ApiError.forbidden('Insufficient permissions');

    const { token, expiresAt } = generateFileToken(doc._id.toString());
    return res.json({ token, expiresAt });
  });

  photo = asyncHandler(async (req, res) => {
    const photo = await photoRepository.findByIdNotDeleted(req.params.id);
    if (!photo) throw ApiError.notFound('Photo not found');

    const fileId = photo._id.toString();
    const { viaToken } = this.#authorizeFileAccess(req, fileId);

    const gated = await this.#scanGate(res, photo.scanState, {
      fileId,
      patientId: photo.patientId.toString(),
      req,
      kind: 'photo',
    });
    if (gated) return gated;

    await auditService.record(AUDIT_ACTIONS.PATIENT_DOCUMENT_DOWNLOADED, {
      actorId: req.auth?.userId || null,
      metadata: { photoId: fileId, patientId: photo.patientId.toString(), viaToken },
      req,
    });

    const absolutePath = await storage.getAbsolutePath(photo.storageKey);
    return res.sendFile(path.resolve(absolutePath), {
      headers: { 'Content-Type': photo.mimeType || 'application/octet-stream' },
    });
  });

  /** Issues a short-lived signed token for `photo` (Task #24) — still requires a valid session. */
  photoToken = asyncHandler(async (req, res) => {
    const photo = await photoRepository.findByIdNotDeleted(req.params.id);
    if (!photo) throw ApiError.notFound('Photo not found');
    if (!this.#canViewClinical(req)) throw ApiError.forbidden('Insufficient permissions');

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
    this.#authorizePatientFileAccess(req, fileId, ownerPatientId);
    if (doc.patientVisibility === PATIENT_VISIBILITY.HIDDEN) throw ApiError.forbidden('Not released');

    const gated = await this.#scanGate(res, doc.scanState, {
      fileId,
      patientId: doc.patientId.toString(),
      req,
      kind: 'document',
    });
    if (gated) return gated;

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
    this.#authorizePatientFileAccess(req, photoFileId, photoOwnerPatientId);
    if (photo.patientVisibility === PATIENT_VISIBILITY.HIDDEN) throw ApiError.forbidden('Not released');

    const photoGated = await this.#scanGate(res, photo.scanState, {
      fileId: photoFileId,
      patientId: photo.patientId.toString(),
      req,
      kind: 'photo',
    });
    if (photoGated) return photoGated;

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
