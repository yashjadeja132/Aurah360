import AppointmentRepository from '../repositories/AppointmentRepository.js';
import { timeToMinutes } from '../helpers/schedule.engine.js';
import ApiError from '../libs/ApiError.js';

/** Minimum gap required between appointments in different branches for the same doctor (APT-001, §6.2). */
const DEFAULT_TRAVEL_BUFFER_MINUTES = 30;

/**
 * Conflict detection for doctor/patient overlaps and cross-branch travel buffer.
 * Cancelled / No-show / Rescheduled do not block (active status filter in repository).
 */
class AppointmentConflictService {
  constructor() {
    this.appointmentRepository = new AppointmentRepository();
  }

  async assertNoConflicts({
    doctorId,
    patientId,
    branchId = null,
    date,
    startTime,
    endTime,
    excludeId = null,
    travelBufferMinutes = DEFAULT_TRAVEL_BUFFER_MINUTES,
  }) {
    const doctorOverlaps = await this.appointmentRepository.findOverlapping({
      doctorId,
      date,
      startTime,
      endTime,
      excludeId,
    });
    if (doctorOverlaps.length) {
      throw ApiError.conflict('Doctor already has an appointment in this time range');
    }

    const patientOverlaps = await this.appointmentRepository.findOverlapping({
      patientId,
      date,
      startTime,
      endTime,
      excludeId,
    });
    if (patientOverlaps.length) {
      throw ApiError.conflict('Patient already has an appointment in this time range');
    }

    if (doctorId && branchId) {
      await this.assertTravelBuffer({ doctorId, branchId, date, startTime, endTime, excludeId, travelBufferMinutes });
    }

    return true;
  }

  /**
   * APT-001 — same doctor cannot have back-to-back appointments in two different branches
   * without at least `travelBufferMinutes` between them (Doctor roster ∩ ... − travel buffer).
   */
  async assertTravelBuffer({ doctorId, branchId, date, startTime, endTime, excludeId = null, travelBufferMinutes = DEFAULT_TRAVEL_BUFFER_MINUTES }) {
    const dayAppts = await this.appointmentRepository.findActiveForDoctorDay(doctorId, date);
    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);

    const violated = dayAppts.some((appt) => {
      if (excludeId && appt._id.toString() === excludeId.toString()) return false;
      if (appt.branchId.toString() === branchId.toString()) return false; // same branch — no travel needed
      const aStart = timeToMinutes(appt.startTime);
      const aEnd = timeToMinutes(appt.endTime);
      const gapBefore = newStart - aEnd; // new appt starts after existing one
      const gapAfter = aStart - newEnd; // new appt ends before existing one
      const gap = gapBefore >= 0 ? gapBefore : gapAfter;
      return gap < travelBufferMinutes;
    });

    if (violated) {
      throw ApiError.conflict(
        `Doctor needs at least ${travelBufferMinutes} minutes to travel between branches — this slot is too close to another branch's appointment`,
        'TRAVEL_BUFFER_VIOLATION'
      );
    }
    return true;
  }

  /** APT-001 — a room/device cannot be double-booked at an overlapping time (§18.3 edge case). */
  async assertResourceAvailable({ field, resourceId, date, startTime, endTime, excludeId = null }) {
    if (!resourceId) return true;
    const dayAppts = await this.appointmentRepository.findActiveForResourceDay(field, resourceId, date);
    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);
    const overlap = dayAppts.some((appt) => {
      if (excludeId && appt._id.toString() === excludeId.toString()) return false;
      const aStart = timeToMinutes(appt.startTime);
      const aEnd = timeToMinutes(appt.endTime);
      return newStart < aEnd && newEnd > aStart;
    });
    if (overlap) {
      throw ApiError.conflict(
        `Selected ${field === 'roomId' ? 'room' : 'device'} is already booked in this time range`,
        field === 'roomId' ? 'ROOM_UNAVAILABLE' : 'DEVICE_UNAVAILABLE'
      );
    }
    return true;
  }

  async filterBookedSlots(slots, doctorId, date) {
    const existing = await this.appointmentRepository.findActiveForDoctorDay(doctorId, date);
    if (!existing.length) return slots;

    return slots.filter((slot) =>
      !existing.some((appt) => {
        const s = timeToMinutes(slot.start);
        const e = timeToMinutes(slot.end);
        const a = timeToMinutes(appt.startTime);
        const b = timeToMinutes(appt.endTime);
        return s < b && e > a;
      })
    );
  }
}

export default AppointmentConflictService;
