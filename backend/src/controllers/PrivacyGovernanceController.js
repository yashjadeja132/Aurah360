import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import PrivacyGovernanceService from '../services/PrivacyGovernanceService.js';

class PrivacyGovernanceController {
  constructor() {
    this.service = new PrivacyGovernanceService();
  }

  grantBreakGlass = asyncHandler(async (req, res) => {
    const grant = await this.service.grantBreakGlass(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Break-glass access granted', data: { grant } });
  });

  listBreakGlassGrants = asyncHandler(async (req, res) => {
    const grants = await this.service.listBreakGlassGrants(req.query);
    return ApiResponse.success(res, { message: 'Break-glass grants retrieved', data: { grants } });
  });

  openRequest = asyncHandler(async (req, res) => {
    const request = await this.service.openRequest(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Privacy request opened', data: { request } });
  });

  listRequests = asyncHandler(async (req, res) => {
    const requests = await this.service.listRequests(req.query);
    return ApiResponse.success(res, { message: 'Privacy requests retrieved', data: { requests } });
  });

  verifyIdentity = asyncHandler(async (req, res) => {
    const request = await this.service.verifyIdentity(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Identity verified', data: { request } });
  });

  resolveRequest = asyncHandler(async (req, res) => {
    const request = await this.service.resolveRequest(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Privacy request resolved', data: { request } });
  });
}

export default PrivacyGovernanceController;
