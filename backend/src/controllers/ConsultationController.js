import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import ConsultationService from '../services/ConsultationService.js';
import ConsultationClinicalService from '../services/ConsultationClinicalService.js';

class ConsultationController {
  constructor() {
    this.consultationService = new ConsultationService();
    this.clinicalService = new ConsultationClinicalService();
  }

  start = asyncHandler(async (req, res) => {
    const data = await this.consultationService.start(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Consultation started', data });
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
    const items = await this.consultationService.listByDoctor(req.query.doctorId, {
      status: req.query.status,
      limit: req.query.limit,
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
    const order = await this.consultationService.createLabOrder(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Lab order created', data: { order } });
  });

  listLabOrders = asyncHandler(async (req, res) => {
    const orders = await this.consultationService.listLabOrders(req.params.id);
    return ApiResponse.success(res, { message: 'Lab orders retrieved', data: { orders } });
  });

  updateLabOrder = asyncHandler(async (req, res) => {
    const order = await this.consultationService.updateLabOrder(
      req.params.labOrderId,
      req.body,
      req.auth.userId,
      req
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
