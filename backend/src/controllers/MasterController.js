import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import MasterService from '../services/MasterService.js';
import ApiError from '../libs/ApiError.js';
import { MASTER_SLUG_TO_TYPE } from '../constants/masterTypes.js';

/**
 * Generic master controller — type resolved from route slug.
 *
 * SEC-030 — masters are ORG-WIDE REFERENCE DATA and are deliberately left unscoped.
 *
 * `Master` has no branch dimension at all: the schema is type + name + code + sortOrder, plus
 * the SERVICE-only fields (categoryId, durationMinutes, price). There is no `branchId` or
 * `branches` to pin, and adding one would not be a scoping fix but a product change — a service
 * catalogue, department list, lead-source list or diagnosis list is a single organisation-wide
 * catalogue by design, and every branch books against the same service ids. Forcing a branchId
 * onto these queries would return nothing at all and break every picker in the app.
 *
 * Writes need no scope either: MASTERS_CREATE / MASTERS_EDIT / MASTERS_DELETE are held only via
 * MASTERS_ALL, i.e. by OWNER and ADMIN, both of which are global-scope roles. Branch roles get
 * at most MASTERS_VIEW (or the narrower MASTERS_LOOKUP for pickers), which is read-only.
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
