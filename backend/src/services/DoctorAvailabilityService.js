import DoctorScheduleRepository from '../repositories/DoctorScheduleRepository.js';
import DoctorLeaveRepository from '../repositories/DoctorLeaveRepository.js';
import BranchRepository from '../repositories/BranchRepository.js';
import BranchHolidayRepository from '../repositories/BranchHolidayRepository.js';
import DoctorBlockedSlotRepository from '../repositories/DoctorBlockedSlotRepository.js';
import DoctorSpecialScheduleRepository from '../repositories/DoctorSpecialScheduleRepository.js';
import { isOnLeave } from '../helpers/leave.engine.js';
import { timeToMinutes } from '../helpers/schedule.engine.js';
import {
  applyBranchRules,
  applyLeaves,
  generateSlots,
  isHoliday,
  isWorkingDay,
  mergeSchedules,
  removeBlockedSlots,
} from '../helpers/scheduling.utils.js';

/**
 * Reusable scheduling & availability engine.
 * Appointment / Reception / Patient App must call this service — never generate slots themselves.
 */
class DoctorAvailabilityService {
  constructor() {
    this.scheduleRepository = new DoctorScheduleRepository();
    this.leaveRepository = new DoctorLeaveRepository();
    this.branchRepository = new BranchRepository();
    this.holidayRepository = new BranchHolidayRepository();
    this.blockedRepository = new DoctorBlockedSlotRepository();
    this.specialRepository = new DoctorSpecialScheduleRepository();
  }

  async #loadContext(doctorId, date, branchId = null) {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const [weekly, leaves, special, blocked] = await Promise.all([
      this.scheduleRepository.findByDoctor(doctorId, { branchId }),
      this.leaveRepository.findByDoctor(doctorId),
      this.specialRepository.findByDoctor(doctorId, {
        branchId,
        from: dayStart,
        to: dayEnd,
      }),
      this.blockedRepository.findByDoctor(doctorId, {
        from: dayStart,
        to: dayEnd,
        branchId,
      }),
    ]);

    let branchSettings = {};
    let holidays = [];
    if (branchId) {
      const branch = await this.branchRepository.findByIdNotDeleted(branchId);
      branchSettings = branch?.settings?.toObject?.() || branch?.settings || {};
      holidays = (await this.holidayRepository.findByBranch(branchId)).map((h) =>
        h.toSafeObject()
      );
      // also consider embedded calendar for backward compatibility
      const embedded = [
        ...(branch?.holidayCalendar || []),
        ...(branchSettings?.holidayCalendar || []),
      ].map((h) => ({
        ...h,
        branchId: branchId.toString(),
        date: h.date,
        isRecurring: h.isRecurring,
      }));
      holidays = [...holidays, ...embedded];
    }

    return {
      weekly: weekly.map((s) => s.toSafeObject()),
      leaves: leaves.map((l) => l.toSafeObject()),
      special: special.map((s) => s.toSafeObject()),
      blocked: blocked.map((b) => b.toSafeObject()),
      branchSettings,
      holidays,
    };
  }

  isHoliday(holidays, date, branchId = null) {
    return isHoliday(holidays, date, branchId);
  }

  isWorkingDay(date, branchSettings = {}) {
    return isWorkingDay(date, branchSettings);
  }

  isOnLeave(leaves, date, branchId = null) {
    return isOnLeave(leaves, date, branchId);
  }

  generateSlots(scheduleRow, branchSettings = {}) {
    return generateSlots(scheduleRow, branchSettings);
  }

  /**
   * Primary API for future Appointment module.
   */
  async getAvailableSlots(doctorId, date, branchId = null) {
    const ctx = await this.#loadContext(doctorId, date, branchId);

    if (branchId) {
      const branchCheck = applyBranchRules({
        date,
        branchSettings: ctx.branchSettings,
        branchHolidays: ctx.holidays,
        branchId,
      });
      if (!branchCheck.ok) {
        return { available: false, reason: branchCheck.reason, slots: [] };
      }
    }

    if (this.isOnLeave(ctx.leaves, date, branchId)) {
      const hasPartial = ctx.leaves.some(
        (l) =>
          (l.leaveType === 'HALF_DAY' || l.leaveType === 'CUSTOM') &&
          (l.startTime || l.endTime)
      );
      if (!hasPartial) {
        return { available: false, reason: 'ON_LEAVE', slots: [] };
      }
    }

    const schedules = mergeSchedules({
      weekly: ctx.weekly,
      special: ctx.special,
      date,
      branchId,
    });

    if (!schedules.length) {
      return { available: false, reason: 'NO_SCHEDULE', slots: [] };
    }

    let slots = schedules.flatMap((row) => this.generateSlots(row, ctx.branchSettings));
    slots = applyLeaves(slots, ctx.leaves, date, branchId);
    slots = removeBlockedSlots(slots, ctx.blocked, date, branchId);

    return {
      available: slots.length > 0,
      reason: slots.length ? null : 'NO_SLOTS',
      slots,
      meta: {
        doctorId: String(doctorId),
        branchId: branchId ? String(branchId) : null,
        date: startOfDay(date).toISOString(),
        holiday: branchId ? this.isHoliday(ctx.holidays, date, branchId) : false,
        onLeave: this.isOnLeave(ctx.leaves, date, branchId),
        blockedCount: ctx.blocked.length,
        specialOverride: schedules.some((s) => s.isSpecial),
      },
    };
  }

  async isDoctorAvailable(doctorId, date, branchId = null) {
    const result = await this.getAvailableSlots(doctorId, date, branchId);
    return result.available;
  }

  /**
   * Validate a candidate slot for booking (Appointment module).
   * Does not create appointments — only checks engine rules.
   */
  async validateSlot(doctorId, { date, startTime, endTime, branchId = null }) {
    if (!startTime || !endTime) {
      return { valid: false, reason: 'MISSING_TIMES' };
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      return { valid: false, reason: 'INVALID_RANGE' };
    }

    const result = await this.getAvailableSlots(doctorId, date, branchId);
    if (!result.available) {
      return { valid: false, reason: result.reason || 'UNAVAILABLE', slots: result.slots };
    }

    const candidates = result.slots.filter(
      (s) => !branchId || !s.branchId || s.branchId === String(branchId)
    );

    /**
     * RSC-001 — a slot request is valid when it starts on the grid and is covered by one slot OR
     * by a run of CONTIGUOUS slots ending exactly on its end time.
     *
     * This is strictly a relaxation: an exact single-slot match is still a match, so nothing that
     * booked before can stop booking now. It exists because service `durationMinutes` is only
     * enforceable if a service longer than one grid slot is bookable at all — a 30-minute service
     * on a 15-minute grid was previously impossible to book. Where the schedule has a buffer
     * between slots the run is not contiguous, so those grids stay as strict as they were.
     */
    const span = [];
    let cursor = startTime;
    while (timeToMinutes(cursor) < timeToMinutes(endTime)) {
      const next = candidates.find((s) => s.start === cursor);
      if (!next) break;
      span.push(next);
      cursor = next.end;
    }

    if (!span.length || cursor !== endTime) {
      return { valid: false, reason: 'SLOT_NOT_AVAILABLE', slots: result.slots };
    }

    return { valid: true, reason: null, slot: span[0], span };
  }

  /** Backward-compatible Module 3 API */
  async getDayAvailability(doctorId, date, branchId = null) {
    return this.getAvailableSlots(doctorId, date, branchId);
  }

  async getWeeklyPreview(doctorId, weekStart, branchId = null) {
    const start = startOfDay(weekStart);
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const availability = await this.getAvailableSlots(doctorId, d, branchId);
      days.push({
        date: startOfDay(d).toISOString(),
        dayOfWeek: d.getDay(),
        ...availability,
      });
    }
    return { doctorId: String(doctorId), branchId: branchId ? String(branchId) : null, days };
  }
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export default DoctorAvailabilityService;
