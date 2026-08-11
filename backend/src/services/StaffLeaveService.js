import ApiError from '../libs/ApiError.js';
import StaffLeaveRepository from '../repositories/StaffLeaveRepository.js';
import UserRepository from '../repositories/UserRepository.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { LEAVE_STATUS } from '../enums/leave.js';
import { ROLES } from '../constants/roles.js';

/**
 * Non-doctor staff leave/absence marking — "Mark leave/blocked (reason)" for nurses,
 * technicians, pharmacy, reception and cashier from the Branch Manager staff roster board.
 * Deliberately no appointment-impact computation here (see StaffLeave.model.js header) — a
 * non-doctor absence doesn't cascade into appointment conflicts the same way DOCTOR leave does.
 */
class StaffLeaveService {
  constructor() {
    this.leaveRepository = new StaffLeaveRepository();
    this.userRepository = new UserRepository();
    this.auditService = new AuditService();
  }

  async #assertNonDoctorUser(userId) {
    const user = await this.userRepository.findByIdNotDeleted(userId);
    if (!user) throw ApiError.notFound('Staff member not found');
    if (user.role === ROLES.DOCTOR) {
      throw ApiError.badRequest('Doctor leave is managed via the doctor leave screen');
    }
    return user;
  }

  async list(userId) {
    await this.#assertNonDoctorUser(userId);
    const leaves = await this.leaveRepository.findByUser(userId);
    return leaves.map((l) => l.toSafeObject());
  }

  async create(userId, payload, actorId, req = null) {
    const user = await this.#assertNonDoctorUser(userId);

    if (new Date(payload.endDate) < new Date(payload.startDate)) {
      throw ApiError.badRequest('endDate must be on or after startDate');
    }
    if (!String(payload.reason || '').trim()) {
      throw ApiError.badRequest('A reason is required to mark leave/blocked');
    }

    const leave = await this.leaveRepository.create({
      userId,
      role: user.role,
      branchId: payload.branchId || user.branch || null,
      leaveType: payload.leaveType || 'FULL_DAY',
      startDate: payload.startDate,
      endDate: payload.endDate,
      reason: payload.reason.trim(),
      status: LEAVE_STATUS.APPROVED,
      createdBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.STAFF_LEAVE_ADDED, {
      actorId,
      metadata: { userId, role: user.role, leaveId: leave._id.toString() },
      req,
    });

    return leave.toSafeObject();
  }

  async softDelete(userId, leaveId, actorId, req = null) {
    await this.#assertNonDoctorUser(userId);
    const leave = await this.leaveRepository.findByIdNotDeleted(leaveId);
    if (!leave || leave.userId.toString() !== userId.toString()) {
      throw ApiError.notFound('Leave not found');
    }
    await this.leaveRepository.updateById(leaveId, {
      deletedAt: new Date(),
      status: LEAVE_STATUS.CANCELLED,
    });
    await this.auditService.record(AUDIT_ACTIONS.STAFF_LEAVE_DELETED, {
      actorId,
      metadata: { userId, leaveId },
      req,
    });
    return true;
  }

  /** Active (today, or `date`) leave rows for a set of user ids — used by the roster board to
   * flag who's absent/blocked today without a per-row query. */
  async findActiveOn(userIds, date = new Date()) {
    if (!userIds?.length) return [];
    const rows = await this.leaveRepository.findActiveOn(userIds, date);
    return rows.map((r) => r.toSafeObject());
  }
}

export default StaffLeaveService;
