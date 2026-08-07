import { describe, it, expect } from 'vitest';
import { timeToMinutes, minutesToTime, generateWorkingSlots } from '../../src/helpers/schedule.engine.js';

describe('schedule.engine', () => {
  it('converts HH:mm to minutes and back losslessly', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30');
  });

  it('returns null for malformed time strings', () => {
    expect(timeToMinutes('bad')).toBeNull();
    expect(timeToMinutes(null)).toBeNull();
  });

  it('generates evenly spaced slots for a simple day', () => {
    const slots = generateWorkingSlots({ startTime: '10:00', endTime: '11:00', slotDuration: 15 });
    expect(slots).toHaveLength(4);
    expect(slots[0]).toEqual({ start: '10:00', end: '10:15' });
    expect(slots.at(-1)).toEqual({ start: '10:45', end: '11:00' });
  });

  it('excludes slots that overlap the lunch break', () => {
    const slots = generateWorkingSlots({
      startTime: '13:00',
      endTime: '15:00',
      lunchStart: '13:30',
      lunchEnd: '14:00',
      slotDuration: 30,
    });
    const overlapsLunch = slots.some((s) => timeToMinutes(s.start) < timeToMinutes('14:00') && timeToMinutes(s.end) > timeToMinutes('13:30'));
    expect(overlapsLunch).toBe(false);
  });

  it('applies a buffer between slots', () => {
    const withBuffer = generateWorkingSlots({ startTime: '10:00', endTime: '11:00', slotDuration: 15, bufferTime: 5 });
    const withoutBuffer = generateWorkingSlots({ startTime: '10:00', endTime: '11:00', slotDuration: 15, bufferTime: 0 });
    expect(withBuffer.length).toBeLessThan(withoutBuffer.length);
  });

  it('returns no slots when the day window is invalid or too short', () => {
    expect(generateWorkingSlots({ startTime: '11:00', endTime: '10:00', slotDuration: 15 })).toEqual([]);
    expect(generateWorkingSlots({ startTime: '10:00', endTime: '10:05', slotDuration: 15 })).toEqual([]);
  });
});
