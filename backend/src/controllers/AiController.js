import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import AiGatewayService from '../services/ai/AiGatewayService.js';
import ClinicalCopilotService from '../services/ai/ClinicalCopilotService.js';
import { resolveRecordScope } from '../helpers/scope.helper.js';

class AiController {
  constructor() {
    this.service = new AiGatewayService();
    this.copilot = new ClinicalCopilotService();
  }

  /** POST /ai/copilot — full structured suggestion set for the current consultation. */
  copilotRun = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const result = await this.copilot.generate(req.body, req.auth.userId, req, scope);
    return ApiResponse.success(res, { message: 'AI copilot run completed', data: result });
  });

  /** POST /ai/copilot/:runId/refine — re-run with the doctor-recorded patient answers. */
  copilotRefine = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const result = await this.copilot.refine(req.params.runId, req.body, req.auth.userId, req, scope);
    return ApiResponse.success(res, { message: 'AI copilot refinement completed', data: result });
  });

  run = asyncHandler(async (req, res) => {
    const result = await this.service.run(req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'AI run completed', data: result });
  });

  disposition = asyncHandler(async (req, res) => {
    const run = await this.service.dispositionRun(req.params.runId, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Disposition recorded', data: { run } });
  });

  /**
   * SEC-030 — pinned to the caller's branch (see AiGatewayService#listRuns for why the pin is on
   * the requesting user's branch rather than on the row).
   */
  listRuns = asyncHandler(async (req, res) => {
    const { branchId } = await resolveRecordScope(req, { branch: true, doctor: false });
    const runs = await this.service.listRuns(req.query, branchId);
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
