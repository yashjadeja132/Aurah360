import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import OrganizationService from '../services/OrganizationService.js';

class OrganizationController {
  constructor() {
    this.service = new OrganizationService();
  }

  get = asyncHandler(async (req, res) => {
    const organization = await this.service.get();
    return ApiResponse.success(res, { message: 'Organization retrieved', data: { organization } });
  });

  update = asyncHandler(async (req, res) => {
    const organization = await this.service.update(req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Organization updated', data: { organization } });
  });
}

export default OrganizationController;
