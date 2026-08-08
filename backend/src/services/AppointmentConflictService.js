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

  /**
   * APT-001 — a room/device cannot be double-booked at an overlapping time (§18.3 edge case).
   *
   * RSC-001 adds the two room settings that used to be inert:
   *
   *  - `capacity` — how many bookings may occupy the resource at the same time. The default is 1,
   *    which reproduces the previous "any overlap is a conflict" behaviour exactly; a room
   *    configured for 3 now genuinely holds 3.
   *  - `bufferMinutes` (the room's `cleaningBufferMinutes`) — turnover time that must separate two
   *    bookings of the same resource. 0 (or unset) means no turnover requirement and is a no-op,
   *    so this can never block a clinic that has not configured one.
   *
   * Buffer is applied by widening the candidate window on both sides; a booking that only collides
   * once the buffer is applied gets its own error code so staff can see it is turnover, not a real
   * double-booking, and know which knob to change.
   */
  async assertResourceAvailable({
    field,
    resourceId,
    date,
    startTime,
    endTime,
    excludeId = null,
    capacity = 1,
    bufferMinutes = 0,
  }) {
    if (!resourceId) return true;
    const dayAppts = await this.appointmentRepository.findActiveForResourceDay(field, resourceId, date);
    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);
    const limit = Math.max(1, Number(capacity) || 1);
    const buffer = Math.max(0, Number(bufferMinutes) || 0);

    const others = dayAppts.filter(
      (appt) => !(excludeId && appt._id.toString() === excludeId.toString())
    );
    const overlapsWith = (appt, pad) => {
      const aStart = timeToMinutes(appt.startTime);
      const aEnd = timeToMinutes(appt.endTime);
      return newStart - pad < aEnd && newEnd + pad > aStart;
    };

    const label = field === 'roomId' ? 'room' : 'device';
    const code = field === 'roomId' ? 'ROOM_UNAVAILABLE' : 'DEVICE_UNAVAILABLE';

    const hardOverlaps = others.filter((appt) => overlapsWith(appt, 0)).length;
    if (hardOverlaps >= limit) {
      throw ApiError.conflict(
        limit > 1
          ? `Selected ${label} is at its capacity of ${limit} concurrent bookings in this time `
            + `range — raise the ${label}'s capacity or choose another time`
          : `Selected ${label} is already booked in this time range`,
        code
      );
    }

    if (buffer > 0) {
      const bufferedOverlaps = others.filter((appt) => overlapsWith(appt, buffer)).length;
      if (bufferedOverlaps >= limit) {
        throw ApiError.conflict(
          `Selected ${label} needs ${buffer} minutes of cleaning turnover between bookings — this `
            + `slot is too close to another booking. Choose a later time or reduce the ${label}'s `
            + 'cleaningBufferMinutes',
          'ROOM_CLEANING_BUFFER'
        );
      }
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
