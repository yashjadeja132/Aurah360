import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import PatientService from '../services/PatientService.js';
import PatientDocumentService from '../services/PatientDocumentService.js';
import PatientTimelineService from '../services/PatientTimelineService.js';
import PatientMergeService from '../services/PatientMergeService.js';

class PatientController {
  constructor() {
    this.patientService = new PatientService();
    this.documentService = new PatientDocumentService();
    this.timelineService = new PatientTimelineService();
    this.mergeService = new PatientMergeService();
  }

  list = asyncHandler(async (req, res) => {
    const result = await this.patientService.list(req.query);
    return ApiResponse.success(res, {
      message: 'Patients retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  getById = asyncHandler(async (req, res) => {
    const patient = await this.patientService.getById(req.params.id);
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
      req.auth.userId
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
