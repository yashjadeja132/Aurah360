import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import BranchService from '../services/BranchService.js';
import { resolveRecordScope } from '../helpers/scope.helper.js';

/**
 * SEC-030 — branches are ORG STRUCTURE, not branch-scoped data, and the reads stay org-wide.
 *
 * DECISION on `list`: a branch-scoped user sees ALL branches, not just their own. `GET /branches`
 * is how the doctor's, receptionist's and nurse's screens resolve which branch they are working
 * in — DOCTOR/RECEPTIONIST/NURSE were granted `branches.view` precisely because those screens
 * 403'd without it, and narrowing the list to a single row (or to nothing before the caller has
 * a branch resolved) would re-break exactly what that fix repaired. Beyond that, branch identity
 * is not confidential: patients see the clinic's sites on the public site, and appointment,
 * transfer and referral payloads name branches the caller does not belong to, so hiding them
 * from the picker buys nothing while breaking the rendering of records they can already read.
 * `getById` is left broad for the same reason — it returns the same row the list already served,
 * and scoping one but not the other would be incoherent.
 *
 * WRITES ARE SCOPED, and that is the actual hole. BRANCH_MANAGER holds BRANCHES_EDIT, which
 * gates `update`, `updateSettings`, `activate` and `deactivate` — so the manager of one site
 * could rename, reconfigure or DEACTIVATE any other site in the organisation, taking it
 * offline. An out-of-scope branch now answers 404 on write. `softDelete` and `transfer` sit
 * behind BRANCHES_DELETE/BRANCHES_MANAGE (OWNER/ADMIN only today) and are scoped anyway, so a
 * future grant of those permissions to a branch role cannot silently reopen this.
 */
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
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const branch = await this.branchService.update(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      scope
    );
    return ApiResponse.success(res, { message: 'Branch updated', data: { branch } });
  });

  updateSettings = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const branch = await this.branchService.updateSettings(
      req.params.id,
      req.body,
      req.auth.userId,
      req,
      scope
    );
    return ApiResponse.success(res, { message: 'Branch settings updated', data: { branch } });
  });

  activate = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const branch = await this.branchService.activate(req.params.id, req.auth.userId, req, scope);
    return ApiResponse.success(res, { message: 'Branch activated', data: { branch } });
  });

  deactivate = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const branch = await this.branchService.deactivate(req.params.id, req.auth.userId, req, scope);
    return ApiResponse.success(res, { message: 'Branch deactivated', data: { branch } });
  });

  softDelete = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const branch = await this.branchService.softDelete(req.params.id, req.auth.userId, req, scope);
    return ApiResponse.success(res, { message: 'Branch deleted', data: { branch } });
  });

  transfer = asyncHandler(async (req, res) => {
    const scope = await resolveRecordScope(req, { branch: true, doctor: false });
    const result = await this.branchService.transferToBranch(
      req.params.id,
      req.body.toBranchId,
      req.auth.userId,
      req,
      scope
    );
    return ApiResponse.success(res, { message: 'Branch transferred', data: result });
  });
}

export default BranchController;
