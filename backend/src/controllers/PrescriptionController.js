import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import PrescriptionService from '../services/PrescriptionService.js';
import MedicineService from '../services/MedicineService.js';
import PrescriptionSafetyService from '../services/PrescriptionSafetyService.js';
import ApiError from '../libs/ApiError.js';
import { scopedListQuery } from '../helpers/scope.helper.js';

/**
 * SEC-030 — the doctor-keyed BROWSE lists (`listByDoctor`, `recentMedicines`, `listTemplates`)
 * resolve a DOCTOR's own doctorId server-side and refuse a doctorId outside the caller's scope.
 * Prescription reads keyed to a patient/consultation/prescription id stay broad and audited so a
 * covering doctor can see what a patient is already taking — withholding that is a safety risk.
 */
class PrescriptionController {
  constructor() {
    this.prescriptionService = new PrescriptionService();
    this.medicineService = new MedicineService();
    this.safetyService = new PrescriptionSafetyService();
  }

  create = asyncHandler(async (req, res) => {
    const prescription = await this.prescriptionService.create(
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.created(res, { message: 'Prescription created', data: { prescription } });
  });

  getById = asyncHandler(async (req, res) => {
    const prescription = await this.prescriptionService.getById(req.params.id);
    return ApiResponse.success(res, { data: { prescription } });
  });

  listByConsultation = asyncHandler(async (req, res) => {
    const items = await this.prescriptionService.listByConsultation(req.params.consultationId);
    return ApiResponse.success(res, { data: items });
  });

  listByPatient = asyncHandler(async (req, res) => {
    const items = await this.prescriptionService.listByPatient(req.params.patientId);
    return ApiResponse.success(res, { data: items });
  });

  listByDoctor = asyncHandler(async (req, res) => {
    const scoped = await scopedListQuery(req, { branch: true, doctor: true });
    if (!scoped.doctorId) throw ApiError.badRequest('doctorId is required');
    const items = await this.prescriptionService.listByDoctor(scoped.doctorId, {
      status: scoped.status,
      limit: scoped.limit,
      branchId: scoped.branchId || null,
    });
    return ApiResponse.success(res, { data: items });
  });

  update = asyncHandler(async (req, res) => {
    const prescription = await this.prescriptionService.updateDraft(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Prescription updated', data: { prescription } });
  });

  remove = asyncHandler(async (req, res) => {
    await this.prescriptionService.deleteDraft(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Draft prescription deleted' });
  });

  /**
   * RX-SAFETY — a blocking allergy/interaction alert makes this return 409
   * PRESCRIPTION_SAFETY_BLOCKED. Pass `{ override: { reason } }` to proceed; that path requires
   * PERMISSIONS.PRESCRIPTION_SAFETY_OVERRIDE and is audited.
   */
  finalize = asyncHandler(async (req, res) => {
    const prescription = await this.prescriptionService.finalize(
      req.params.id,
      req.body || {},
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Prescription finalized', data: { prescription } });
  });

  safetyCheck = asyncHandler(async (req, res) => {
    const safety = await this.prescriptionService.safetyCheck(req.params.id, req);
    return ApiResponse.success(res, { message: 'Safety check evaluated', data: { safety } });
  });

  listInteractionRules = asyncHandler(async (req, res) => {
    const data = await this.safetyService.listInteractionRules();
    return ApiResponse.success(res, { message: 'Interaction rules retrieved', data });
  });

  createInteractionRule = asyncHandler(async (req, res) => {
    const rule = await this.safetyService.createInteractionRule(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Interaction rule created', data: { rule } });
  });

  updateInteractionRule = asyncHandler(async (req, res) => {
    const rule = await this.safetyService.setInteractionRuleActive(
      req.params.id,
      req.body.isActive,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Interaction rule updated', data: { rule } });
  });

  duplicate = asyncHandler(async (req, res) => {
    const prescription = await this.prescriptionService.duplicate(
      req.params.id,
      req.auth.userId,
      req
    );
    return ApiResponse.created(res, { message: 'Prescription duplicated', data: { prescription } });
  });

  print = asyncHandler(async (req, res) => {
    const data = await this.prescriptionService.getPrintData(
      req.params.id,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Print data ready', data });
  });

  // Doctor-scoped only: these rows are already keyed to a single doctor, so a branch pin would
  // add nothing while making an unassigned-branch account fail for no security benefit.
  recentMedicines = asyncHandler(async (req, res) => {
    const scoped = await scopedListQuery(req, { branch: false, doctor: true });
    if (!scoped.doctorId) throw ApiError.badRequest('doctorId is required');
    const items = await this.prescriptionService.recentMedicines(scoped.doctorId);
    return ApiResponse.success(res, { data: items });
  });

  listTemplates = asyncHandler(async (req, res) => {
    const scoped = await scopedListQuery(req, { branch: false, doctor: true });
    if (!scoped.doctorId) throw ApiError.badRequest('doctorId is required');
    const items = await this.prescriptionService.listTemplates(scoped.doctorId);
    return ApiResponse.success(res, { data: items });
  });

  createTemplate = asyncHandler(async (req, res) => {
    const template = await this.prescriptionService.createTemplate(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Template saved', data: { template } });
  });

  deleteTemplate = asyncHandler(async (req, res) => {
    await this.prescriptionService.deleteTemplate(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Template deleted' });
  });

  applyTemplate = asyncHandler(async (req, res) => {
    const prescription = await this.prescriptionService.applyTemplate(
      req.params.id,
      req.body.consultationId,
      req.auth.userId,
      req
    );
    return ApiResponse.created(res, {
      message: 'Template applied',
      data: { prescription },
    });
  });

  searchMedicines = asyncHandler(async (req, res) => {
    const items = await this.medicineService.search(req.query.q, req.query.limit || 20);
    return ApiResponse.success(res, { data: items });
  });

  listMedicines = asyncHandler(async (req, res) => {
    const result = await this.medicineService.list(req.query);
    return ApiResponse.success(res, {
      message: 'Medicines retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  getMedicine = asyncHandler(async (req, res) => {
    const medicine = await this.medicineService.getById(req.params.id);
    return ApiResponse.success(res, { data: { medicine } });
  });

  createMedicine = asyncHandler(async (req, res) => {
    const medicine = await this.medicineService.create(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Medicine created', data: { medicine } });
  });

  updateMedicine = asyncHandler(async (req, res) => {
    const medicine = await this.medicineService.update(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Medicine updated', data: { medicine } });
  });
}

export default PrescriptionController;
