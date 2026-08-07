import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import AiGatewayService from '../services/ai/AiGatewayService.js';

class AiController {
  constructor() {
    this.service = new AiGatewayService();
  }

  run = asyncHandler(async (req, res) => {
    const result = await this.service.run(req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'AI run completed', data: result });
  });

  disposition = asyncHandler(async (req, res) => {
    const run = await this.service.dispositionRun(req.params.runId, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Disposition recorded', data: { run } });
  });

  listRuns = asyncHandler(async (req, res) => {
    const runs = await this.service.listRuns(req.query);
    return ApiResponse.success(res, { message: 'AI runs retrieved', data: { runs } });
  });

  listFeatureFlags = asyncHandler(async (req, res) => {
    const flags = await this.service.listFeatureFlags();
    return ApiResponse.success(res, { message: 'AI feature flags retrieved', data: { flags } });
  });

  setFeatureFlag = asyncHandler(async (req, res) => {
    const flag = await this.service.setFeatureFlag(req.params.useCase, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'AI feature flag updated', data: { flag } });
  });

  governanceSummary = asyncHandler(async (req, res) => {
    const summary = await this.service.governanceSummary();
    return ApiResponse.success(res, { message: 'AI governance summary retrieved', data: summary });
  });
}

export default AiController;
