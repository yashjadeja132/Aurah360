import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import TreatmentPlanService from '../services/TreatmentPlanService.js';
import ApiError from '../libs/ApiError.js';
import { scopedListQuery } from '../helpers/scope.helper.js';

/**
 * SEC-030 — `listByDoctor` (the doctor's own plan worklist) is scoped to the caller's branch and,
 * for a DOCTOR, to their own server-resolved doctorId. Plan reads by plan/patient/consultation id
 * stay broad and audited so a covering doctor can review an in-flight plan before treating.
 * Protocol and package catalogues are organisation-level reference data, not patient data, and
 * are intentionally not row-scoped.
 */
class TreatmentPlanController {
  constructor() {
    this.service = new TreatmentPlanService();
  }

  create = asyncHandler(async (req, res) => {
    const plan = await this.service.create(req.body, req.auth.userId, req);
    return ApiResponse.created(res, { message: 'Treatment plan created', data: { plan } });
  });

  getById = asyncHandler(async (req, res) => {
    const plan = await this.service.getById(req.params.id);
    return ApiResponse.success(res, { data: { plan } });
  });

  listByConsultation = asyncHandler(async (req, res) => {
    const items = await this.service.listByConsultation(req.params.consultationId);
    return ApiResponse.success(res, { data: items });
  });

  listByPatient = asyncHandler(async (req, res) => {
    const items = await this.service.listByPatient(req.params.patientId);
    return ApiResponse.success(res, { data: items });
  });

  listByDoctor = asyncHandler(async (req, res) => {
    const scoped = await scopedListQuery(req, { branch: true, doctor: true });
    if (!scoped.doctorId) throw ApiError.badRequest('doctorId is required');
    const items = await this.service.listByDoctor(scoped.doctorId, {
      status: scoped.status,
      limit: scoped.limit,
      branchId: scoped.branchId || null,
    });
    return ApiResponse.success(res, { data: items });
  });

  /**
   * Cross-patient "Treatment plans awaiting approval" queue. Scoped the same way as
   * `listByDoctor`: a DOCTOR only ever sees their own plans (server-resolved doctorId, ignoring
   * any doctorId the client might pass), while OWNER/ADMIN see the whole (branch-scoped) queue.
   */
  pendingApproval = asyncHandler(async (req, res) => {
    const scoped = await scopedListQuery(req, { branch: true, doctor: true });
    const onHold =
      req.query.onHold === undefined ? undefined : req.query.onHold === 'true';
    const result = await this.service.listPendingApproval({
      doctorId: scoped.doctorId || null,
      branchId: scoped.branchId || null,
      onHold,
      page: req.query.page,
      limit: req.query.limit,
    });
    return ApiResponse.success(res, {
      message: 'Approval queue retrieved',
      data: result.items,
      meta: result.meta,
    });
  });

  hold = asyncHandler(async (req, res) => {
    const plan = await this.service.hold(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Plan held', data: { plan } });
  });

  unhold = asyncHandler(async (req, res) => {
    const plan = await this.service.unhold(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Plan hold cleared', data: { plan } });
  });

  escalate = asyncHandler(async (req, res) => {
    const plan = await this.service.escalate(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Plan escalated', data: { plan } });
  });

  update = asyncHandler(async (req, res) => {
    const plan = await this.service.update(req.params.id, req.body, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Treatment plan updated', data: { plan } });
  });

  remove = asyncHandler(async (req, res) => {
    await this.service.deleteDraft(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Draft treatment plan deleted' });
  });

  applyProtocol = asyncHandler(async (req, res) => {
    const plan = await this.service.applyProtocol(
      req.params.id,
      req.body.protocolId,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Protocol applied', data: { plan } });
  });

  applyPackage = asyncHandler(async (req, res) => {
    const plan = await this.service.applyPackage(
      req.params.id,
      req.body.packageId,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Package added', data: { plan } });
  });

  clearPackage = asyncHandler(async (req, res) => {
    const plan = await this.service.clearPackage(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Package cleared', data: { plan } });
  });

  recommend = asyncHandler(async (req, res) => {
    const plan = await this.service.recommend(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Plan marked recommended', data: { plan } });
  });

  approve = asyncHandler(async (req, res) => {
    const plan = await this.service.approve(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Plan approved', data: { plan } });
  });

  accept = asyncHandler(async (req, res) => {
    const plan = await this.service.accept(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Plan accepted', data: { plan } });
  });

  reject = asyncHandler(async (req, res) => {
    const plan = await this.service.reject(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Plan rejected', data: { plan } });
  });

  cancel = asyncHandler(async (req, res) => {
    const plan = await this.service.cancel(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Plan cancelled', data: { plan } });
  });

  complete = asyncHandler(async (req, res) => {
    const plan = await this.service.complete(req.params.id, req.auth.userId);
    return ApiResponse.success(res, { message: 'Plan completed', data: { plan } });
  });

  listConsents = asyncHandler(async (req, res) => {
    const items = await this.service.listConsents(req.params.id);
    return ApiResponse.success(res, { data: items });
  });

  acceptConsent = asyncHandler(async (req, res) => {
    const plan = await this.service.acceptConsent(
      req.params.id,
      req.params.consentId,
      req.body,
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Consent accepted', data: { plan } });
  });

  print = asyncHandler(async (req, res) => {
    const data = await this.service.getPrintData(req.params.id, req.auth.userId, req);
    return ApiResponse.success(res, { message: 'Print data ready', data });
  });

  listProtocols = asyncHandler(async (req, res) => {
    const items = await this.service.listProtocols(req.query);
    return ApiResponse.success(res, { data: items });
  });

  getProtocol = asyncHandler(async (req, res) => {
    const protocol = await this.service.getProtocol(req.params.id);
    return ApiResponse.success(res, { data: { protocol } });
  });

  createProtocol = asyncHandler(async (req, res) => {
    const protocol = await this.service.createProtocol(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Protocol created', data: { protocol } });
  });

  updateProtocol = asyncHandler(async (req, res) => {
    const protocol = await this.service.updateProtocol(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Protocol updated', data: { protocol } });
  });

  createProtocolVersion = asyncHandler(async (req, res) => {
    const protocol = await this.service.createNewProtocolVersion(
      req.params.id,
      req.body,
      req.auth.userId
    );
    return ApiResponse.created(res, { message: 'New protocol version created', data: { protocol } });
  });

  listPackages = asyncHandler(async (req, res) => {
    const items = await this.service.listPackages(req.query);
    return ApiResponse.success(res, { data: items });
  });

  getPackage = asyncHandler(async (req, res) => {
    const pkg = await this.service.getPackage(req.params.id);
    return ApiResponse.success(res, { data: { package: pkg } });
  });

  createPackage = asyncHandler(async (req, res) => {
    const pkg = await this.service.createPackage(req.body, req.auth.userId);
    return ApiResponse.created(res, { message: 'Package created', data: { package: pkg } });
  });

  updatePackage = asyncHandler(async (req, res) => {
    const pkg = await this.service.updatePackage(req.params.id, req.body, req.auth.userId);
    return ApiResponse.success(res, { message: 'Package updated', data: { package: pkg } });
  });

  transferPackageOwnership = asyncHandler(async (req, res) => {
    const plan = await this.service.transferPackageOwnership(
      req.params.id,
      req.body.targetBranchId,
      { reason: req.body.reason },
      req.auth.userId,
      req
    );
    return ApiResponse.success(res, { message: 'Package ownership transferred', data: { plan } });
  });
}

export default TreatmentPlanController;
