import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import PatientImportService from '../services/PatientImportService.js';

class PatientImportController {
  constructor() {
    this.service = new PatientImportService();
  }

  dryRun = asyncHandler(async (req, res) => {
    const batch = await this.service.dryRun(req.body.rows, req.body.sourceSystem, req.auth.userId);
    return ApiResponse.created(res, { message: 'Dry run completed', data: { batch } });
  });

  commit = asyncHandler(async (req, res) => {
    const batch = await this.service.commit(req.params.batchId, req.body.rows, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Import committed', data: { batch } });
  });

  getBatch = asyncHandler(async (req, res) => {
    const batch = await this.service.getBatch(req.params.batchId);
    return ApiResponse.success(res, { message: 'Import batch retrieved', data: { batch } });
  });
}

export default PatientImportController;
