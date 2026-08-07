import ApiError from '../libs/ApiError.js';
import DoctorRepository from '../repositories/DoctorRepository.js';
import DoctorLeaveRepository from '../repositories/DoctorLeaveRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { LEAVE_STATUS } from '../enums/leave.js';
import { findOverlappingLeaves, isOnLeave } from '../helpers/leave.engine.js';

class DoctorLeaveService {
  constructor() {
    this.doctorRepository = new DoctorRepository();
    this.leaveRepository = new DoctorLeaveRepository();
    this.branchRepository = new BranchRepository();
    this.auditService = new AuditService();
  }

  async #assertDoctor(doctorId) {
    const doctor = await this.doctorRepository.findByIdNotDeleted(doctorId);
    if (!doctor) throw ApiError.notFound('Doctor not found');
    return doctor;
  }

  /**
   * Exposed for Appointment module.
   */
  async checkOnLeave(doctorId, date, branchId = null) {
    const leaves = await this.leaveRepository.findByDoctor(doctorId);
    return isOnLeave(
      leaves.map((l) => l.toSafeObject()),
      date,
      branchId
    );
  }

  async list(doctorId) {
    await this.#assertDoctor(doctorId);
    const leaves = await this.leaveRepository.findByDoctor(doctorId);
    return leaves.map((l) => l.toSafeObject());
  }

  async create(doctorId, payload, actorId, req = null) {
    await this.#assertDoctor(doctorId);

    if (new Date(payload.endDate) < new Date(payload.startDate)) {
      throw ApiError.badRequest('endDate must be on or after startDate');
    }

    if (payload.branchId) {
      const branch = await this.branchRepository.findByIdNotDeleted(payload.branchId);
      if (!branch) throw ApiError.notFound('Branch not found');
    }

    const existing = await this.leaveRepository.findActiveAround(
      doctorId,
      payload.startDate,
      payload.endDate
    );
    const overlaps = findOverlappingLeaves(
      existing.map((l) => l.toSafeObject()),
      payload.startDate,
      payload.endDate,
      { branchId: payload.branchId || null }
    );
    if (overlaps.length) {
      throw ApiError.conflict('Leave overlaps an existing leave period');
    }

    const leave = await this.leaveRepository.create({
      doctorId,
      branchId: payload.branchId || null,
      leaveType: payload.leaveType,
      startDate: payload.startDate,
      endDate: payload.endDate,
      reason: payload.reason || null,
      status: payload.status || LEAVE_STATUS.APPROVED,
      approvedBy: actorId,
      createdBy: actorId,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.DOCTOR_LEAVE_ADDED, {
      actorId,
      metadata: { doctorId, leaveId: leave._id.toString() },
      req,
    });

    return leave.toSafeObject();
  }

  async update(doctorId, leaveId, payload, actorId, req = null) {
    await this.#assertDoctor(doctorId);
    const leave = await this.leaveRepository.findByIdNotDeleted(leaveId);
    if (!leave || leave.doctorId.toString() !== doctorId.toString()) {
      throw ApiError.notFound('Leave not found');
    }

    const updates = { updatedBy: actorId };
    ['leaveType', 'startDate', 'endDate', 'reason', 'status', 'branchId'].forEach((key) => {
      if (payload[key] !== undefined) updates[key] = payload[key];
    });

    const updated = await this.leaveRepository.updateById(leaveId, updates);

    await this.auditService.record(AUDIT_ACTIONS.DOCTOR_LEAVE_UPDATED, {
      actorId,
      metadata: { doctorId, leaveId },
      req,
    });

    return updated.toSafeObject();
  }

  async softDelete(doctorId, leaveId, actorId, req = null) {
    await this.#assertDoctor(doctorId);
    const leave = await this.leaveRepository.findByIdNotDeleted(leaveId);
    if (!leave || leave.doctorId.toString() !== doctorId.toString()) {
      throw ApiError.notFound('Leave not found');
    }

    await this.leaveRepository.updateById(leaveId, {
      deletedAt: new Date(),
      status: LEAVE_STATUS.CANCELLED,
      updatedBy: actorId,
    });

    await this.auditService.record(AUDIT_ACTIONS.DOCTOR_LEAVE_DELETED, {
      actorId,
      metadata: { doctorId, leaveId },
      req,
    });

    return true;
  }
}

export default DoctorLeaveService;
