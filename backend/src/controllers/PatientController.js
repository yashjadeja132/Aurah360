import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import PatientService from '../services/PatientService.js';
import PatientDocumentService from '../services/PatientDocumentService.js';
import PatientTimelineService from '../services/PatientTimelineService.js';
import PatientMergeService from '../services/PatientMergeService.js';
import AuditService from '../services/AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { scopedListQuery } from '../helpers/scope.helper.js';

/**
 * SEC-030 — `list` (the patient BROWSE screen) is scoped to the caller's branch. It is
 * deliberately NOT narrowed to a DOCTOR's own primaryDoctorId: within a branch a doctor
 * routinely treats walk-ins and covers colleagues' patients, and hiding them would be a
 * clinical-safety regression, not a security win. Record reads (`getById`, documents,
 * timeline) are likewise left broad, and `getById` — the full record view — is itself
 * audited (SEC-004/§16.8) — see the break-glass model (SEC-002).
 */
class PatientController {
  constructor() {
    this.patientService = new PatientService();
    this.documentService = new PatientDocumentService();
    this.timelineService = new PatientTimelineService();
    this.mergeService = new PatientMergeService();
    this.auditService = new AuditService();
  }

  list = asyncHandler(async (req, res) => {
    const result = await this.patientService.list(
      await scopedListQuery(req, { branch: true })
    );
    return ApiResponse.success(res, {
      message: 'Patients retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  getById = asyncHandler(async (req, res) => {
    const patient = await this.patientService.getById(req.params.id);
    // SEC-004/§16.8 — opening the full patient record is a sensitive view, not just a write.
    await this.auditService.record(AUDIT_ACTIONS.PATIENT_RECORD_VIEWED, {
      actorId: req.auth?.userId,
      metadata: { patientId: req.params.id },
      resourceType: 'Patient',
      resourceId: req.params.id,
      req,
    });
    return ApiResponse.success(res, { data: { patient } });
  });

  create = asyncHandler(async (req, res) => {
    const patient = await this.patientService.create(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Patient created', data: { patient } });
  });

  update = asyncHandler(async (req, res) => {
    const patient = await this.patientService.update(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Patient updated', data: { patient } });
  });

  updateConsent = asyncHandler(async (req, res) => {
    const patient = await this.patientService.updateConsent(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Consent updated', data: { patient } });
  });

  /** PAT-005 — staff-only verification of a guardian link (gates dependent portal access). */
  setGuardianVerified = asyncHandler(async (req, res) => {
    const patient = await this.patientService.setGuardianVerified(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Guardian verification updated', data: { patient } });
  });

  softDelete = asyncHandler(async (req, res) => {
    await this.patientService.softDelete(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Patient deleted' });
  });

  checkDuplicates = asyncHandler(async (req, res) => {
    const matches = await this.patientService.detectDuplicates(req.body);
    return ApiResponse.success(res, { data: { matches } });
  });

  mergePreview = asyncHandler(async (req, res) => {
    const preview = await this.mergeService.previewMerge(req.body.primaryId, req.body.duplicateId);
    return ApiResponse.success(res, { message: 'Merge preview generated', data: preview });
  });

  merge = asyncHandler(async (req, res) => {
    const result = await this.mergeService.merge(
      req.body.primaryId,
      req.body.duplicateId,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Patients merged', data: result });
  });

  listDocuments = asyncHandler(async (req, res) => {
    const documents = await this.documentService.list(req.params.id);
    return ApiResponse.success(res, { data: documents });
  });

  uploadDocument = asyncHandler(async (req, res) => {
    const document = await this.documentService.upload(
      req.params.id,
      {
        file: req.file,
        category: req.body.category,
        title: req.body.title,
        notes: req.body.notes,
        clinicalDate: req.body.clinicalDate,
        source: req.body.source,
        relatedVisitId: req.body.relatedVisitId,
        branchId: req.body.branchId,
      },
      req.auth.userId,
      req
    );
    return ApiResponse.created(res, { message: 'Document uploaded', data: { document } });
  });

  reviewDocument = asyncHandler(async (req, res) => {
    const document = await this.documentService.review(
      req.params.id,
      req.params.documentId,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Document review updated', data: { document } });
  });

  releaseDocument = asyncHandler(async (req, res) => {
    const document = await this.documentService.release(
      req.params.id,
      req.params.documentId,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Document release updated', data: { document } });
  });

  renameDocument = asyncHandler(async (req, res) => {
    const document = await this.documentService.rename(
      req.params.id,
      req.params.documentId,
      req.body.title,
      req.auth.userId,
      req.body.reason || null,
      req
    );
    return ApiResponse.success(res, { message: 'Document renamed', data: { document } });
  });

  deleteDocument = asyncHandler(async (req, res) => {
    await this.documentService.softDelete(
      req.params.id,
      req.params.documentId,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Document deleted' });
  });

  timeline = asyncHandler(async (req, res) => {
    const events = await this.timelineService.getTimeline(req.params.id, {
      limit: Number(req.query.limit) || 50,
    });
    return ApiResponse.success(res, { data: events });
  });
}

export default PatientController;
