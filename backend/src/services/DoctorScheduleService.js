import ApiError from '../libs/ApiError.js';
import DoctorRepository from '../repositories/DoctorRepository.js';
import DoctorScheduleRepository from '../repositories/DoctorScheduleRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import AuditService from './AuditService.js';
import DoctorAvailabilityService from './DoctorAvailabilityService.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { generateWorkingSlots, resolveScheduleWithBranchDefaults } from '../helpers/schedule.engine.js';

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

  async upsertWeekly(doctorId, { branchId, days }, actorId, req = null) {
    const doctor = await this.#assertDoctor(doctorId);
    const branch = await this.branchRepository.findByIdNotDeleted(branchId);
    if (!branch) throw ApiError.notFound('Branch not found');

    if (!doctor.branches.some((id) => id.toString() === branchId.toString())) {
      throw ApiError.badRequest('Doctor is not assigned to this branch');
    }

    if (!Array.isArray(days) || !days.length) {
      throw ApiError.badRequest('Weekly days are required');
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

    return saved;
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
