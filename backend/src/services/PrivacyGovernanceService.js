import ApiError from '../libs/ApiError.js';
import BreakGlassAccess from '../models/BreakGlassAccess.model.js';
import PrivacyRequest from '../models/PrivacyRequest.model.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { PRIVACY_REQUEST_STATUS } from '../enums/privacy.js';
import config from '../config/index.js';
import eventBus from '../events/eventBus.js';

/** Break-glass access grants and data-subject rights case management (SEC-002, PRV-002/003). */
class PrivacyGovernanceService {
  constructor() {
    this.auditService = new AuditService();
  }

  // --- Break-glass -------------------------------------------------------------
  async grantBreakGlass({ patientId, resourceType, resourceId, reason }, actorId, req = null) {
    if (!reason) throw ApiError.badRequest('A reason is required for break-glass access');
    if (!req?.stepUpVerified) {
      throw ApiError.forbidden('Break-glass requires recent step-up re-authentication', 'STEP_UP_REQUIRED');
    }

    const grant = await BreakGlassAccess.create({
      userId: actorId,
      patientId,
      resourceType,
      resourceId,
      reason,
      expiresAt: new Date(Date.now() + config.security.breakGlassTtlMinutes * 60 * 1000),
    });

    await this.auditService.record(AUDIT_ACTIONS.BREAK_GLASS_USED, {
      actorId,
      metadata: { breakGlassId: grant._id.toString(), patientId, resourceType, reason },
      resourceType,
      resourceId,
      req,
    });

    // Prominent alert — owner/privacy officer notification channel.
    eventBus.emitDomain('BreakGlassUsed', { breakGlassId: grant._id.toString(), userId: actorId, patientId, reason });

    return grant.toSafeObject();
  }

  async hasValidBreakGlass(userId, patientId) {
    const grant = await BreakGlassAccess.findOne({ userId, patientId, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .exec();
    return Boolean(grant);
  }

  async listBreakGlassGrants(query = {}) {
    const filter = {};
    if (query.userId) filter.userId = query.userId;
    if (query.patientId) filter.patientId = query.patientId;
    const rows = await BreakGlassAccess.find(filter).sort({ createdAt: -1 }).limit(200).exec();
    return rows.map((r) => r.toSafeObject());
  }

  // --- Privacy / data-subject rights -------------------------------------------------------------
  async openRequest(payload, actorId, req = null) {
    const dueDate = payload.dueDate || new Date(Date.now() + 30 * 24 * 3600 * 1000); // 30-day default SLA
    const request = await PrivacyRequest.create({ ...payload, dueDate, createdBy: actorId, ownerId: payload.ownerId || actorId });

    await this.auditService.record(AUDIT_ACTIONS.PRIVACY_REQUEST_OPENED, {
      actorId,
      metadata: { privacyRequestId: request._id.toString(), type: payload.type, patientId: payload.patientId },
      req,
    });
    return request.toSafeObject();
  }

  async listRequests(query = {}) {
    const filter = {};
    if (query.patientId) filter.patientId = query.patientId;
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    const rows = await PrivacyRequest.find(filter).sort({ dueDate: 1 }).exec();
    return rows.map((r) => r.toSafeObject());
  }

  async verifyIdentity(id, actorId, req = null) {
    const request = await PrivacyRequest.findById(id);
    if (!request) throw ApiError.notFound('Privacy request not found');
    request.identityVerifiedBy = actorId;
    request.identityVerifiedAt = new Date();
    request.status = PRIVACY_REQUEST_STATUS.IN_REVIEW;
    await request.save();
    await this.auditService.record(AUDIT_ACTIONS.PRIVACY_REQUEST_UPDATED, { actorId, metadata: { privacyRequestId: id }, req });
    return request.toSafeObject();
  }

  async resolveRequest(id, { status, resolutionNotes, denialReason, exceptionReasoned }, actorId, req = null) {
    const request = await PrivacyRequest.findById(id);
    if (!request) throw ApiError.notFound('Privacy request not found');

    request.status = status;
    request.resolutionNotes = resolutionNotes || null;
    request.denialReason = denialReason || null;
    request.exceptionReasoned = exceptionReasoned || null;
    request.resolvedBy = actorId;
    request.resolvedAt = new Date();
    await request.save();

    await this.auditService.record(AUDIT_ACTIONS.PRIVACY_REQUEST_RESOLVED, {
      actorId,
      metadata: { privacyRequestId: id, status, hasException: Boolean(exceptionReasoned) },
      req,
    });
    return request.toSafeObject();
  }
}

export default PrivacyGovernanceService;
