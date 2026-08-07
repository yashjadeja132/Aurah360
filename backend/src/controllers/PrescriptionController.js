import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import PrescriptionService from '../services/PrescriptionService.js';
import MedicineService from '../services/MedicineService.js';

class PrescriptionController {
  constructor() {
    this.prescriptionService = new PrescriptionService();
    this.medicineService = new MedicineService();
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
    const items = await this.prescriptionService.listByDoctor(req.query.doctorId, {
      status: req.query.status,
      limit: req.query.limit,
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

  finalize = asyncHandler(async (req, res) => {
    const prescription = await this.prescriptionService.finalize(
      req.params.id,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Prescription finalized', data: { prescription } });
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

  recentMedicines = asyncHandler(async (req, res) => {
    const items = await this.prescriptionService.recentMedicines(req.query.doctorId);
    return ApiResponse.success(res, { data: items });
  });

  listTemplates = asyncHandler(async (req, res) => {
    const items = await this.prescriptionService.listTemplates(req.query.doctorId);
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
