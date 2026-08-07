/**
 * Schedule engine — reusable by Appointment module later.
 * Pure utilities; no DB access.
 */

/** "HH:mm" → minutes from midnight */
export function timeToMinutes(time) {
  if (!time || typeof time !== 'string') return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** minutes → "HH:mm" */
export function minutesToTime(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Generate working slots for one day schedule row.
 * Respects lunch break and buffer between slots.
 *
 * @returns {{ start: string, end: string }[]}
 */
export function generateWorkingSlots({
  startTime,
  endTime,
  lunchStart = null,
  lunchEnd = null,
  slotDuration = 15,
  bufferTime = 0,
} = {}) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const lunchFrom = lunchStart ? timeToMinutes(lunchStart) : null;
  const lunchTo = lunchEnd ? timeToMinutes(lunchEnd) : null;

  if (start == null || end == null || end <= start || slotDuration < 1) {
    return [];
  }

  const slots = [];
  let cursor = start;
  const step = slotDuration + (bufferTime || 0);

  while (cursor + slotDuration <= end) {
    const slotEnd = cursor + slotDuration;
    const overlapsLunch =
      lunchFrom != null &&
      lunchTo != null &&
      cursor < lunchTo &&
      slotEnd > lunchFrom;

    if (!overlapsLunch) {
      slots.push({
        start: minutesToTime(cursor),
        end: minutesToTime(slotEnd),
      });
    }

    cursor += step;
  }

  return slots;
}

/**
 * Merge doctor schedule with optional branch settings defaults.
 */
export function resolveScheduleWithBranchDefaults(schedule, branchSettings = {}) {
  return {
    dayOfWeek: schedule.dayOfWeek,
    isWorking: schedule.isWorking !== false,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    lunchStart: schedule.lunchStart ?? branchSettings?.lunchBreak?.startTime ?? null,
    lunchEnd: schedule.lunchEnd ?? branchSettings?.lunchBreak?.endTime ?? null,
    slotDuration:
      schedule.slotDuration ||
      branchSettings?.timeSlotDurationMinutes ||
      15,
    bufferTime:
      schedule.bufferTime ??
      branchSettings?.appointmentBufferMinutes ??
      0,
    maximumAppointments: schedule.maximumAppointments || 0,
  };
}

/**
 * Build availability for a date given weekly schedule rows + leaves.
 * Appointment module will call this via DoctorAvailabilityService.
 */
export function buildDayAvailability({
  date,
  schedules = [],
  branchId,
  leaves = [],
  branchSettings = {},
  isOnLeaveFn,
}) {
  const dayOfWeek = date instanceof Date ? date.getDay() : new Date(date).getDay();
  const daySchedules = schedules.filter(
    (s) =>
      s.dayOfWeek === dayOfWeek &&
      s.isWorking !== false &&
      (!branchId || s.branchId?.toString() === branchId.toString())
  );

  if (!daySchedules.length) {
    return { available: false, reason: 'NO_SCHEDULE', slots: [] };
  }

  if (isOnLeaveFn && isOnLeaveFn(leaves, date, branchId)) {
    return { available: false, reason: 'ON_LEAVE', slots: [] };
  }

  const workingDays = branchSettings?.workingDays;
  if (Array.isArray(workingDays) && workingDays.length && !workingDays.includes(dayOfWeek)) {
    return { available: false, reason: 'BRANCH_CLOSED', slots: [] };
  }

  const slots = daySchedules.flatMap((row) => {
    const resolved = resolveScheduleWithBranchDefaults(row, branchSettings);
    return generateWorkingSlots(resolved).map((slot) => ({
      ...slot,
      branchId: row.branchId?.toString?.() || row.branchId,
      scheduleId: row.id || row._id?.toString?.(),
    }));
  });

  return {
    available: slots.length > 0,
    reason: slots.length ? null : 'NO_SLOTS',
    slots,
  };
}

export default {
  timeToMinutes,
  minutesToTime,
  generateWorkingSlots,
  resolveScheduleWithBranchDefaults,
  buildDayAvailability,
};
