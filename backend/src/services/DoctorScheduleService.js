import ApiError from '../libs/ApiError.js';
import DoctorRepository from '../repositories/DoctorRepository.js';
import DoctorScheduleRepository from '../repositories/DoctorScheduleRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import AuditService from './AuditService.js';
import DoctorAvailabilityService from './DoctorAvailabilityService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { SLOT_COMMITTED_STATUSES } from '../enums/appointment.js';
import {
  generateWorkingSlots,
  resolveScheduleWithBranchDefaults,
  timeToMinutes,
} from '../helpers/schedule.engine.js';

class DoctorScheduleService {
  constructor() {
    this.doctorRepository = new DoctorRepository();
    this.scheduleRepository = new DoctorScheduleRepository();
    this.branchRepository = new BranchRepository();
    this.auditService = new AuditService();
    this.availabilityService = new DoctorAvailabilityService();
  }

  async #assertDoctor(doctorId) {
    const doctor = await this.doctorRepository.findByIdNotDeleted(doctorId);
    if (!doctor) throw ApiError.notFound('Doctor not found');
    return doctor;
  }

  async list(doctorId, query = {}) {
    await this.#assertDoctor(doctorId);
    const rows = await this.scheduleRepository.findByDoctor(doctorId, {
      branchId: query.branchId || null,
    });
    return rows.map((r) => r.toSafeObject());
  }

  /**
   * §2.2 "roster change after confirmed bookings" — list existing CONFIRMED-slot appointments
   * that a proposed weekly-schedule edit would fall outside of (day switched off, or the
   * working window narrowed past an appointment's start time). Computed BEFORE any write, same
   * "impact summary before commit" shape as BranchService#deactivate.
   */
  async #computeScheduleImpact(doctorId, branchId, days) {
    const existingRows = await this.scheduleRepository.findByDoctor(doctorId, { branchId });
    const existingByDay = new Map(existingRows.map((r) => [r.dayOfWeek, r.toSafeObject()]));

    const shrinkingDays = days.filter((day) => {
      const prior = existingByDay.get(day.dayOfWeek);
      if (!prior || !prior.isWorking) return false; // nothing was booked against a non-working day
      if (day.isWorking === false) return true; // switched off entirely
      const newStart = timeToMinutes(day.startTime);
      const newEnd = timeToMinutes(day.endTime);
      const oldStart = timeToMinutes(prior.startTime);
      const oldEnd = timeToMinutes(prior.endTime);
      return newStart > oldStart || newEnd < oldEnd;
    });

    if (!shrinkingDays.length) return [];

    const Appointment = (await import('../models/Appointment.model.js')).default;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = await Appointment.find({
      doctorId,
      branchId,
      deletedAt: null,
      status: { $in: SLOT_COMMITTED_STATUSES },
      appointmentDate: { $gte: today },
    })
      .populate('patientId', 'fullName')
      .lean();

    const shrinkingByDow = new Map(shrinkingDays.map((d) => [d.dayOfWeek, d]));

    return rows
      .filter((apt) => {
        const dow = new Date(apt.appointmentDate).getDay();
        const day = shrinkingByDow.get(dow);
        if (!day) return false;
        if (day.isWorking === false) return true;
        const start = timeToMinutes(apt.startTime);
        return start < timeToMinutes(day.startTime) || start >= timeToMinutes(day.endTime);
      })
      .map((apt) => ({
        appointmentId: apt._id.toString(),
        patientName: apt.patientId?.fullName || null,
        appointmentDate: apt.appointmentDate,
        startTime: apt.startTime,
        status: apt.status,
      }));
  }

  async upsertWeekly(
    doctorId,
    { branchId, days, acknowledgeOverride = false, overrideReason = null },
    actorId,
    req = null
  ) {
    const doctor = await this.#assertDoctor(doctorId);
    const branch = await this.branchRepository.findByIdNotDeleted(branchId);
    if (!branch) throw ApiError.notFound('Branch not found');

    if (!doctor.branches.some((id) => id.toString() === branchId.toString())) {
      throw ApiError.badRequest('Doctor is not assigned to this branch');
    }

    if (!Array.isArray(days) || !days.length) {
      throw ApiError.badRequest('Weekly days are required');
    }

    const impactedAppointments = await this.#computeScheduleImpact(doctorId, branchId, days);

    if (impactedAppointments.length && !acknowledgeOverride) {
      throw new ApiError(
        409,
        'This schedule change conflicts with existing confirmed appointments. Reassign, reschedule, or override with a reason.',
        { code: 'ROSTER_IMPACT_CONFIRMATION_REQUIRED', errors: { impactedAppointments } }
      );
    }

    if (impactedAppointments.length && acknowledgeOverride && !overrideReason?.trim()) {
      throw ApiError.badRequest('overrideReason is required to proceed despite impacted appointments');
    }

    const saved = [];
    for (const day of days) {
      const row = await this.scheduleRepository.upsertDay(
        doctorId,
        branchId,
        day.dayOfWeek,
        {
          startTime: day.startTime,
          endTime: day.endTime,
          lunchStart: day.lunchStart ?? '13:00',
          lunchEnd: day.lunchEnd ?? '14:00',
          slotDuration: day.slotDuration ?? doctor.consultationDuration ?? 15,
          bufferTime: day.bufferTime ?? 5,
          maximumAppointments: day.maximumAppointments ?? 0,
          isWorking: day.isWorking !== false,
        }
      );
      saved.push(row.toSafeObject());
    }

    await this.auditService.record(AUDIT_ACTIONS.DOCTOR_SCHEDULE_UPDATED, {
      actorId,
      metadata: { doctorId, branchId, days: days.length },
      req,
    });

    if (impactedAppointments.length && acknowledgeOverride) {
      await this.auditService.record(AUDIT_ACTIONS.ROSTER_OVERRIDE_RECORDED, {
        actorId,
        metadata: {
          doctorId,
          branchId,
          context: 'SCHEDULE',
          reason: overrideReason,
          impactedAppointmentIds: impactedAppointments.map((a) => a.appointmentId),
        },
        req,
      });
    }

    return { schedules: saved, impactedAppointments, overridden: Boolean(acknowledgeOverride) };
  }

  async remove(doctorId, scheduleId, actorId, req = null) {
    await this.#assertDoctor(doctorId);
    const removed = await this.scheduleRepository.deleteByIdForDoctor(scheduleId, doctorId);
    if (!removed) throw ApiError.notFound('Schedule row not found');

    await this.auditService.record(AUDIT_ACTIONS.DOCTOR_SCHEDULE_UPDATED, {
      actorId,
      metadata: { doctorId, deletedScheduleId: scheduleId },
      req,
    });

    return true;
  }

  /**
   * Preview slots for a schedule row (used by UI / future appointments).
   */
  async previewSlots(doctorId, { branchId, dayOfWeek }) {
    await this.#assertDoctor(doctorId);
    const row = await this.scheduleRepository.findOneSlot(doctorId, branchId, dayOfWeek);
    if (!row || !row.isWorking) return [];

    const branch = await this.branchRepository.findByIdNotDeleted(branchId);
    const resolved = resolveScheduleWithBranchDefaults(
      row.toSafeObject(),
      branch?.settings || {}
    );
    return generateWorkingSlots(resolved);
  }

  getAvailabilityService() {
    return this.availabilityService;
  }
}

export default DoctorScheduleService;
