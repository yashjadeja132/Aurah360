import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import BranchService from '../services/BranchService.js';

class BranchController {
  constructor() {
    this.branchService = new BranchService();
  }

  list = asyncHandler(async (req, res) => {
    const result = await this.branchService.list(req.query);
    return ApiResponse.success(res, {
      message: 'Branches retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  getById = asyncHandler(async (req, res) => {
    const branch = await this.branchService.getById(req.params.id);
    return ApiResponse.success(res, { data: { branch } });
  });

  create = asyncHandler(async (req, res) => {
    const branch = await this.branchService.create(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Branch created', data: { branch } });
  });

  update = asyncHandler(async (req, res) => {
    const branch = await this.branchService.update(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Branch updated', data: { branch } });
  });

  updateSettings = asyncHandler(async (req, res) => {
    const branch = await this.branchService.updateSettings(
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Branch settings updated', data: { branch } });
  });

  activate = asyncHandler(async (req, res) => {
    const branch = await this.branchService.activate(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Branch activated', data: { branch } });
  });

  deactivate = asyncHandler(async (req, res) => {
    const branch = await this.branchService.deactivate(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Branch deactivated', data: { branch } });
  });

  softDelete = asyncHandler(async (req, res) => {
    const branch = await this.branchService.softDelete(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Branch deleted', data: { branch } });
  });

  transfer = asyncHandler(async (req, res) => {
    const result = await this.branchService.transferToBranch(
      req.params.id,
      req.body.toBranchId,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Branch transferred', data: result });
  });
}

export default BranchController;
