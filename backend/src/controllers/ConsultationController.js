import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import ConsultationService from '../services/ConsultationService.js';
import ConsultationClinicalService from '../services/ConsultationClinicalService.js';
import ApiError from '../libs/ApiError.js';
import { scopedListQuery, resolveRecordScope, hasGlobalScope } from '../helpers/scope.helper.js';

/**
 * SEC-030 — `listByDoctor` and `labOrderReviewQueue` are BROWSE lists and are row-scoped to the
 * caller's branch and, for a DOCTOR, to their own doctorId. Everything keyed to one consultation
 * or one patient (`getWorkspace`, `getById`, `listByPatient`, `patientSummary`, photos,
 * SOAP versions) is deliberately left broad and audited: a doctor covering a colleague
 * must be able to open the record in front of them (the model break-glass assumes).
 *
 * LAB ORDERS are the exception to that leniency and ARE row-scoped (`resolveRecordScope`): they
 * are addressed by an opaque id with no patient context in the URL, so leaving them broad meant
 * any holder of `consultation.view` could walk another branch's results by id (IDOR). Out-of-scope
 * ids answer 404 rather than 403 so the endpoint never confirms that the record exists.
 */
class ConsultationController {
  constructor() {
    this.consultationService = new ConsultationService();
    this.clinicalService = new ConsultationClinicalService();
  }

  start = asyncHandler(async (req, res) => {
    const data = await this.consultationService.start(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Consultation started', data });
  });

  runPrecheck = asyncHandler(async (req, res) => {
    const { enqueueClinicalPrecheck } = await import('../queues/aiJobs.js');
    await enqueueClinicalPrecheck(req.params.id, req.auth.userId, { force: true });
    return ApiResponse.success(res, { message: 'AI precheck queued', data: { queued: true } });
  });

  patientPhotos = asyncHandler(async (req, res) => {
    const data = await this.consultationService.patientPhotosGrouped(req.params.id);
    return ApiResponse.success(res, { message: 'Patient photos by visit', data });
  });

  getWorkspace = asyncHandler(async (req, res) => {
    const data = await this.consultationService.getWorkspace(req.params.id);
    return ApiResponse.success(res, { data });
  });

  getById = asyncHandler(async (req, res) => {
    const consultation = await this.consultationService.getById(req.params.id);
    return ApiResponse.success(res, { data: { consultation } });
  });

  listByPatient = asyncHandler(async (req, res) => {
    const items = await this.consultationService.listByPatient(req.params.patientId);
    return ApiResponse.success(res, { data: items });
  });

  listByDoctor = asyncHandler(async (req, res) => {
    const scoped = await scopedListQuery(req, { branch: true, doctor: true });
    // OWNER/ADMIN can omit doctorId to see every doctor's consultations (branch-scoped).
    if (!scoped.doctorId) {
      if (!hasGlobalScope(req.auth)) throw ApiError.badRequest('doctorId is required');
      const all = await this.consultationService.listRecent({
        status: scoped.status,
        limit: scoped.limit,
        branchId: scoped.branchId || null,
      });
      return ApiResponse.success(res, { data: all });
    }
    const items = await this.consultationService.listByDoctor(scoped.doctorId, {
      status: scoped.status,
      limit: scoped.limit,
      branchId: scoped.branchId || null,
    });
    return ApiResponse.success(res, { data: items });
  });

  patientSummary = asyncHandler(async (req, res) => {
    const data = await this.consultationService.patientSummary(req.params.patientId);
    return ApiResponse.success(res, { data });
  });

  update = asyncHandler(async (req, res) => {
    const data = await this.consultationService.updateMeta(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Consultation saved', data });
  });

  sign = asyncHandler(async (req, res) => {
    const data = await this.consultationService.sign(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Consultation signed', data });
  });

  lock = asyncHandler(async (req, res) => {
    const data = await this.consultationService.lock(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Consultation locked', data });
  });

  unlock = asyncHandler(async (req, res) => {
    const data = await this.consultationService.unlock(
      req.params.id,
      req.auth.userId,
      req.auth.role,
      req
    );
    return ApiResponse.success(res, { message: 'Consultation unlocked', data });
  });

  releaseSummary = asyncHandler(async (req, res) => {
    const data = await this.consultationService.releasePatientSummary(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Patient summary released', data });
  });

  amend = asyncHandler(async (req, res) => {
    const data = await this.consultationService.amend(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Addendum recorded', data });
  });

  createLabOrder = asyncHandler(async (req, res) => {
    const order = await this.consultationService.createLabOrder(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      await resolveRecordScope(req)
    );
    return ApiResponse.created(res, { message: 'Lab order created', data: { order } });
  });

  listLabOrders = asyncHandler(async (req, res) => {
    const orders = await this.consultationService.listLabOrders(
      req.params.id,
      await resolveRecordScope(req)
    );
    return ApiResponse.success(res, { message: 'Lab orders retrieved', data: { orders } });
  });

  labOrderReviewQueue = asyncHandler(async (req, res) => {
    const result = await this.consultationService.listLabOrderReviewQueue(
      await scopedListQuery(req, { branch: true, doctor: true })
    );
    return ApiResponse.success(res, {
      message: 'Report review queue retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  updateLabOrder = asyncHandler(async (req, res) => {
    const order = await this.consultationService.updateLabOrder(
      req.params.labOrderId,
      req.body,
      req.auth.userId,
      req,
      await resolveRecordScope(req)
    );
    return ApiResponse.success(res, { message: 'Lab order updated', data: { order } });
  });

  autosaveSoap = asyncHandler(async (req, res) => {
    const soap = await this.clinicalService.autosaveSoap(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'SOAP autosaved', data: { soap } });
  });

  soapVersions = asyncHandler(async (req, res) => {
    const data = await this.clinicalService.getSoapVersions(req.params.id);
    return ApiResponse.success(res, { data });
  });

  saveVitals = asyncHandler(async (req, res) => {
    const vitals = await this.clinicalService.saveVitals(
      req.params.id,
      req.body,
      req.auth.userId
    );
    return ApiResponse.success(res, { message: 'Vitals saved', data: { vitals } });
  });

  saveDiagnosis = asyncHandler(async (req, res) => {
    const diagnosis = await this.clinicalService.saveDiagnosis(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Diagnosis saved', data: { diagnosis } });
  });

  saveExamination = asyncHandler(async (req, res) => {
    const examination = await this.clinicalService.saveExamination(
      req.params.id,
      req.body,
      req.auth.userId
    );
    return ApiResponse.success(res, { message: 'Examination saved', data: { examination } });
  });

  uploadPhoto = asyncHandler(async (req, res) => {
    const photo = await this.clinicalService.uploadPhoto(
      req.params.id,
      {
        file: req.file,
        photoType: req.body.photoType,
        title: req.body.title,
        bodyRegion: req.body.bodyRegion,
        consentVerified: req.body.consentVerified,
      },
      req.auth.userId,
      req
    );
    return ApiResponse.created(res, { message: 'Photo uploaded', data: { photo } });
  });

  listPhotos = asyncHandler(async (req, res) => {
    const photos = await this.clinicalService.listPhotos(req.params.id);
    return ApiResponse.success(res, { data: photos });
  });

  verifyPhotoConsent = asyncHandler(async (req, res) => {
    const photo = await this.clinicalService.verifyPhotoConsent(
      req.params.photoId,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Consent verified', data: { photo } });
  });

  /** IMG-005 — release/un-release a clinical photo to the patient portal. */
  releasePhoto = asyncHandler(async (req, res) => {
    const photo = await this.clinicalService.releasePhoto(
      req.params.photoId,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Photo release updated', data: { photo } });
  });

  listTemplates = asyncHandler(async (req, res) => {
    const items = await this.clinicalService.listTemplates(
      req.query.doctorId,
      req.query.templateType
    );
    return ApiResponse.success(res, { data: items });
  });

  createTemplate = asyncHandler(async (req, res) => {
    const template = await this.clinicalService.createTemplate(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Template created', data: { template } });
  });

  deleteTemplate = asyncHandler(async (req, res) => {
    await this.clinicalService.deleteTemplate(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Template deleted' });
  });

  aiSummarize = asyncHandler(async (req, res) => {
    const result = await this.consultationService.getAiInterface().summarizeConsultation(req.body);
    return ApiResponse.success(res, { data: result });
  });

  aiDraftSoap = asyncHandler(async (req, res) => {
    const result = await this.consultationService.getAiInterface().draftSoap(req.body);
    return ApiResponse.success(res, { data: result });
  });

  aiSuggestDiagnosis = asyncHandler(async (req, res) => {
    const result = await this.consultationService.getAiInterface().suggestDiagnosis(req.body);
    return ApiResponse.success(res, { data: result });
  });

  aiSuggestQuestions = asyncHandler(async (req, res) => {
    const result = await this.consultationService.getAiInterface().suggestQuestions(req.body);
    return ApiResponse.success(res, { data: result });
  });
}

export default ConsultationController;
