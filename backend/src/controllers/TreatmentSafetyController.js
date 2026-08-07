import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import TreatmentSafetyService from '../services/TreatmentSafetyService.js';

class TreatmentSafetyController {
  constructor() {
    this.service = new TreatmentSafetyService();
  }

  recordPatchTest = asyncHandler(async (req, res) => {
    const test = await this.service.recordPatchTest(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Patch test recorded', data: { test } });
  });

  reviewPatchTest = asyncHandler(async (req, res) => {
    const test = await this.service.reviewPatchTest(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Patch test reviewed', data: { test } });
  });

  listPatchTestsForPatient = asyncHandler(async (req, res) => {
    const tests = await this.service.listPatchTestsForPatient(req.params.patientId);
    return ApiResponse.success(res, { message: 'Patch tests retrieved', data: { tests } });
  });

  reportAdverseEvent = asyncHandler(async (req, res) => {
    const event = await this.service.reportAdverseEvent(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Adverse event reported', data: { event } });
  });

  listAdverseEvents = asyncHandler(async (req, res) => {
    const events = await this.service.listAdverseEvents(req.query);
    return ApiResponse.success(res, { message: 'Adverse events retrieved', data: { events } });
  });

  updateAdverseEvent = asyncHandler(async (req, res) => {
    const event = await this.service.updateAdverseEvent(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Adverse event updated', data: { event } });
  });

  closeAdverseEvent = asyncHandler(async (req, res) => {
    const event = await this.service.closeAdverseEvent(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Adverse event closed', data: { event } });
  });
}

export default TreatmentSafetyController;
