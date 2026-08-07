import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import MasterService from '../services/MasterService.js';
import ApiError from '../libs/ApiError.js';
import { MASTER_SLUG_TO_TYPE } from '../constants/masterTypes.js';

/**
 * Generic master controller — type resolved from route slug.
 */
class MasterController {
  constructor() {
    this.masterService = new MasterService();
  }

  #resolveType(req) {
    const type = MASTER_SLUG_TO_TYPE[req.params.masterType];
    if (!type) throw ApiError.notFound('Unknown master type');
    return type;
  }

  list = asyncHandler(async (req, res) => {
    const type = this.#resolveType(req);
    const result = await this.masterService.list(type, req.query);
    return ApiResponse.success(res, {
      message: 'Masters retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  listActive = asyncHandler(async (req, res) => {
    const type = this.#resolveType(req);
    const items = await this.masterService.listActive(type);
    return ApiResponse.success(res, { data: items });
  });

  getById = asyncHandler(async (req, res) => {
    const type = this.#resolveType(req);
    const master = await this.masterService.getById(type, req.params.id);
    return ApiResponse.success(res, { data: { master } });
  });

  create = asyncHandler(async (req, res) => {
    const type = this.#resolveType(req);
    const master = await this.masterService.create(type, req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Master created', data: { master } });
  });

  update = asyncHandler(async (req, res) => {
    const type = this.#resolveType(req);
    const master = await this.masterService.update(
      type,
      req.params.id,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Master updated', data: { master } });
  });

  activate = asyncHandler(async (req, res) => {
    const type = this.#resolveType(req);
    const master = await this.masterService.activate(type, req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Master activated', data: { master } });
  });

  deactivate = asyncHandler(async (req, res) => {
    const type = this.#resolveType(req);
    const master = await this.masterService.deactivate(type, req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Master deactivated', data: { master } });
  });

  softDelete = asyncHandler(async (req, res) => {
    const type = this.#resolveType(req);
    const master = await this.masterService.softDelete(type, req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Master deleted', data: { master } });
  });
}

export default MasterController;
