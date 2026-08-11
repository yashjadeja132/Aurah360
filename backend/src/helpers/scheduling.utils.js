import { timeToMinutes, generateWorkingSlots } from './schedule.engine.js';
import { isOnLeave } from './leave.engine.js';
import { LEAVE_TYPE } from '../enums/leave.js';

/**
 * Module 5 scheduling utilities — pure functions for the availability engine.
 */

export function calculateSlotDuration(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start == null || end == null || end <= start) return 0;
  return end - start;
}

export function validateWorkingHours(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start == null || end == null) return { ok: false, message: 'Invalid time format' };
  if (end <= start) return { ok: false, message: 'endTime must be after startTime' };
  return { ok: true };
}

export function validateLunch(startTime, endTime, lunchStart, lunchEnd) {
  if (!lunchStart && !lunchEnd) return { ok: true };
  if (!lunchStart || !lunchEnd) {
    return { ok: false, message: 'Both lunchStart and lunchEnd are required' };
  }
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const lunchFrom = timeToMinutes(lunchStart);
  const lunchTo = timeToMinutes(lunchEnd);
  if (lunchFrom == null || lunchTo == null || lunchTo <= lunchFrom) {
    return { ok: false, message: 'Invalid lunch window' };
  }
  if (lunchFrom < start || lunchTo > end) {
    return { ok: false, message: 'Lunch must fall within working hours' };
  }
  return { ok: true };
}

export function validateSlotDuration(slotDuration) {
  if (!slotDuration || slotDuration < 5 || slotDuration > 240) {
    return { ok: false, message: 'slotDuration must be between 5 and 240 minutes' };
  }
  return { ok: true };
}

/**
 * Prefer special (temporary) schedules over weekly rows for the same branch/day.
 */
export function mergeSchedules({ weekly = [], special = [], date, branchId = null } = {}) {
  const dayOfWeek = new Date(date).getDay();
  const specialForDay = special.filter((s) => {
    if (branchId && s.branchId?.toString() !== branchId.toString()) return false;
    return sameCalendarDay(s.date, date);
  });

  if (specialForDay.length) {
    return specialForDay
      .filter((s) => s.isWorking !== false)
      .map((s) => ({
        ...s,
        dayOfWeek,
        isSpecial: true,
      }));
  }

  return weekly.filter(
    (s) =>
      s.dayOfWeek === dayOfWeek &&
      s.isWorking !== false &&
      (!branchId || s.branchId?.toString() === branchId.toString())
  );
}

export function applyBranchRules({ date, branchSettings = {}, branchHolidays = [], branchId = null }) {
  const dayOfWeek = new Date(date).getDay();
  const workingDays = branchSettings?.workingDays;

  if (Array.isArray(workingDays) && workingDays.length && !workingDays.includes(dayOfWeek)) {
    return { ok: false, reason: 'BRANCH_CLOSED' };
  }

  const weekly = branchSettings?.weeklySchedule || [];
  const dayRow = weekly.find((d) => d.day === dayOfWeek);
  if (dayRow?.isClosed) {
    return { ok: false, reason: 'BRANCH_CLOSED' };
  }

  if (isHoliday(branchHolidays, date, branchId)) {
    return { ok: false, reason: 'HOLIDAY' };
  }

  return { ok: true, reason: null };
}

export function isHoliday(holidays = [], date, branchId = null) {
  const target = new Date(date);
  const tMonth = target.getMonth();
  const tDate = target.getDate();
  const tYear = target.getFullYear();

  return holidays.some((h) => {
    if (branchId && h.branchId && h.branchId.toString() !== branchId.toString()) return false;
    if (h.deletedAt) return false;
    const d = new Date(h.date);
    if (h.isRecurring) {
      return d.getMonth() === tMonth && d.getDate() === tDate;
    }
    return (
      d.getFullYear() === tYear &&
      d.getMonth() === tMonth &&
      d.getDate() === tDate
    );
  });
}

export function isWorkingDay(date, branchSettings = {}) {
  const dayOfWeek = new Date(date).getDay();
  const workingDays = branchSettings?.workingDays;
  if (Array.isArray(workingDays) && workingDays.length) {
    return workingDays.includes(dayOfWeek);
  }
  const weekly = branchSettings?.weeklySchedule || [];
  const dayRow = weekly.find((d) => d.day === dayOfWeek);
  if (dayRow) return !dayRow.isClosed;
  return dayOfWeek !== 0;
}

/**
 * Apply leave — full day blocks all; half/custom can remove partial windows.
 */
export function applyLeaves(slots, leaves = [], date, branchId = null) {
  if (!slots.length) return slots;
  if (isOnLeave(leaves, date, branchId)) {
    const dayLeaves = leaves.filter((leave) => leaveAffectsDay(leave, date, branchId));
    const fullDay = dayLeaves.some(
      (l) => !l.leaveType || l.leaveType === LEAVE_TYPE.FULL_DAY
    );
    if (fullDay) return [];

    return slots.filter((slot) => {
      return !dayLeaves.some((leave) => slotOverlapsLeaveWindow(slot, leave));
    });
  }
  return slots;
}

function leaveAffectsDay(leave, date, branchId) {
  if (leave.deletedAt) return false;
  if (leave.status && leave.status !== 'APPROVED') return false;
  if (branchId && leave.branchId && leave.branchId.toString() !== branchId.toString()) {
    return false;
  }
  const target = startOfDay(date).getTime();
  const from = startOfDay(leave.startDate).getTime();
  const to = endOfDay(leave.endDate).getTime();
  return target >= from && target <= to;
}

function slotOverlapsLeaveWindow(slot, leave) {
  if (!leave.startTime && !leave.endTime) return true;
  const slotStart = timeToMinutes(slot.start);
  const slotEnd = timeToMinutes(slot.end);
  const leaveStart = timeToMinutes(leave.startTime || '00:00');
  const leaveEnd = timeToMinutes(leave.endTime || '23:59');
  return slotStart < leaveEnd && slotEnd > leaveStart;
}

export function removeBlockedSlots(slots, blocked = [], date, branchId = null) {
  if (!slots.length || !blocked.length) return slots;

  return slots.filter((slot) => {
    const slotStart = combineDateAndTime(date, slot.start);
    const slotEnd = combineDateAndTime(date, slot.end);
    return !blocked.some((block) => {
      if (block.deletedAt) return false;
      if (
        branchId &&
        block.branchId &&
        block.branchId.toString() !== branchId.toString()
      ) {
        return false;
      }
      const bStart = new Date(block.startAt).getTime();
      const bEnd = new Date(block.endAt).getTime();
      return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
    });
  });
}

export function generateSlots(scheduleRow, branchSettings = {}) {
  const lunchEnabled = branchSettings?.lunchBreak?.enabled !== false;
  const config = {
    startTime: scheduleRow.startTime,
    endTime: scheduleRow.endTime,
    lunchStart: lunchEnabled
      ? scheduleRow.lunchStart ?? branchSettings?.lunchBreak?.startTime ?? null
      : null,
    lunchEnd: lunchEnabled
      ? scheduleRow.lunchEnd ?? branchSettings?.lunchBreak?.endTime ?? null
      : null,
    slotDuration:
      scheduleRow.slotDuration ||
      branchSettings?.timeSlotDurationMinutes ||
      15,
    bufferTime:
      scheduleRow.bufferTime ??
      branchSettings?.appointmentBufferMinutes ??
      0,
  };

  return generateWorkingSlots(config).map((slot) => ({
    ...slot,
    branchId: scheduleRow.branchId?.toString?.() || scheduleRow.branchId || null,
    scheduleId: scheduleRow.id || scheduleRow._id?.toString?.() || null,
    isSpecial: Boolean(scheduleRow.isSpecial),
    maximumAppointments: scheduleRow.maximumAppointments || 0,
  }));
}

export function slotsOverlap(aStart, aEnd, bStart, bEnd) {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(aEnd) > timeToMinutes(bStart);
}

function sameCalendarDay(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
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

function combineDateAndTime(date, time) {
  const d = new Date(date);
  const [h, m] = String(time).split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export default {
  calculateSlotDuration,
  mergeSchedules,
  removeBlockedSlots,
  applyLeaves,
  applyBranchRules,
  generateSlots,
  isHoliday,
  isWorkingDay,
  validateWorkingHours,
  validateLunch,
  validateSlotDuration,
};
