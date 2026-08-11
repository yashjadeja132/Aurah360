import ApiError from '../libs/ApiError.js';
import DoctorRepository from '../repositories/DoctorRepository.js';
import DoctorLeaveRepository from '../repositories/DoctorLeaveRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import AuditService from './AuditService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { LEAVE_STATUS } from '../enums/leave.js';
import { SLOT_COMMITTED_STATUSES } from '../enums/appointment.js';
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

  /**
   * §2.2 roster-impact decision, leave side — existing CONFIRMED-slot appointments that a leave
   * window (optionally branch-scoped) would overlap. Computed BEFORE the leave is written.
   */
  async #computeLeaveImpact(doctorId, { branchId = null, startDate, endDate }) {
    const Appointment = (await import('../models/Appointment.model.js')).default;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const from = new Date(startDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(endDate);
    to.setHours(23, 59, 59, 999);
    const rangeStart = from > today ? from : today;

    const query = {
      doctorId,
      deletedAt: null,
      status: { $in: SLOT_COMMITTED_STATUSES },
      appointmentDate: { $gte: rangeStart, $lte: to },
    };
    if (branchId) query.branchId = branchId;

    const rows = await Appointment.find(query).populate('patientId', 'fullName').lean();

    return rows.map((apt) => ({
      appointmentId: apt._id.toString(),
      patientName: apt.patientId?.fullName || null,
      appointmentDate: apt.appointmentDate,
      startTime: apt.startTime,
      status: apt.status,
    }));
  }

  async create(
    doctorId,
    { acknowledgeOverride = false, overrideReason = null, ...payload },
    actorId,
    req = null
  ) {
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

    const impactedAppointments = await this.#computeLeaveImpact(doctorId, payload);

    if (impactedAppointments.length && !acknowledgeOverride) {
      throw new ApiError(
        409,
        'This leave conflicts with existing confirmed appointments. Reassign, reschedule, or override with a reason.',
        { code: 'ROSTER_IMPACT_CONFIRMATION_REQUIRED', errors: { impactedAppointments } }
      );
    }
    if (impactedAppointments.length && acknowledgeOverride && !overrideReason?.trim()) {
      throw ApiError.badRequest('overrideReason is required to proceed despite impacted appointments');
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

    if (impactedAppointments.length && acknowledgeOverride) {
      await this.auditService.record(AUDIT_ACTIONS.ROSTER_OVERRIDE_RECORDED, {
        actorId,
        metadata: {
          doctorId,
          leaveId: leave._id.toString(),
          context: 'LEAVE',
          reason: overrideReason,
          impactedAppointmentIds: impactedAppointments.map((a) => a.appointmentId),
        },
        req,
      });
    }

    return { leave: leave.toSafeObject(), impactedAppointments, overridden: Boolean(acknowledgeOverride) };
  }

  async update(
    doctorId,
    leaveId,
    { acknowledgeOverride = false, overrideReason = null, ...payload },
    actorId,
    req = null
  ) {
    await this.#assertDoctor(doctorId);
    const leave = await this.leaveRepository.findByIdNotDeleted(leaveId);
    if (!leave || leave.doctorId.toString() !== doctorId.toString()) {
      throw ApiError.notFound('Leave not found');
    }

    const updates = { updatedBy: actorId };
    ['leaveType', 'startDate', 'endDate', 'reason', 'status', 'branchId'].forEach((key) => {
      if (payload[key] !== undefined) updates[key] = payload[key];
    });

    const datesOrScopeChanged = ['startDate', 'endDate', 'branchId'].some(
      (key) => payload[key] !== undefined
    );

    let impactedAppointments = [];
    if (datesOrScopeChanged) {
      impactedAppointments = await this.#computeLeaveImpact(doctorId, {
        branchId: updates.branchId !== undefined ? updates.branchId : leave.branchId,
        startDate: updates.startDate || leave.startDate,
        endDate: updates.endDate || leave.endDate,
      });

      if (impactedAppointments.length && !acknowledgeOverride) {
        throw new ApiError(
          409,
          'This leave change conflicts with existing confirmed appointments. Reassign, reschedule, or override with a reason.',
          { code: 'ROSTER_IMPACT_CONFIRMATION_REQUIRED', errors: { impactedAppointments } }
        );
      }
      if (impactedAppointments.length && acknowledgeOverride && !overrideReason?.trim()) {
        throw ApiError.badRequest('overrideReason is required to proceed despite impacted appointments');
      }
    }

    const updated = await this.leaveRepository.updateById(leaveId, updates);

    await this.auditService.record(AUDIT_ACTIONS.DOCTOR_LEAVE_UPDATED, {
      actorId,
      metadata: { doctorId, leaveId },
      req,
    });

    if (impactedAppointments.length && acknowledgeOverride) {
      await this.auditService.record(AUDIT_ACTIONS.ROSTER_OVERRIDE_RECORDED, {
        actorId,
        metadata: {
          doctorId,
          leaveId,
          context: 'LEAVE',
          reason: overrideReason,
          impactedAppointmentIds: impactedAppointments.map((a) => a.appointmentId),
        },
        req,
      });
    }

    return { leave: updated.toSafeObject(), impactedAppointments, overridden: Boolean(acknowledgeOverride) };
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
