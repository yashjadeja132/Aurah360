import { z } from 'zod';
import { BLOCKED_SLOT_REASON_LIST } from '../enums/scheduling.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

export const availabilityQuerySchema = z.object({
  doctorId: objectId,
  date: z.coerce.date(),
  branchId: objectId.optional(),
});

export const weeklyPreviewQuerySchema = z.object({
  doctorId: objectId,
  weekStart: z.coerce.date(),
  branchId: objectId.optional(),
});

export const validateSlotSchema = z.object({
  doctorId: objectId,
  date: z.coerce.date(),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  branchId: objectId.optional().nullable(),
});

export const checkAvailabilitySchema = z.object({
  doctorId: objectId,
  date: z.coerce.date(),
  branchId: objectId.optional().nullable(),
});

export const createHolidaySchema = z.object({
  branchId: objectId,
  holidayName: z.string().min(1).max(120).trim(),
  date: z.coerce.date(),
  isRecurring: z.boolean().optional(),
  description: z.string().max(500).optional().nullable(),
});

export const updateHolidaySchema = createHolidaySchema.partial().omit({ branchId: true });

export const holidayIdParamSchema = z.object({ id: objectId });

export const holidayListQuerySchema = z.object({
  branchId: objectId,
});

export const createBlockedSlotSchema = z.object({
  doctorId: objectId,
  branchId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  title: z.string().min(1).max(120).trim(),
  reason: z.enum(BLOCKED_SLOT_REASON_LIST).optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  description: z.string().max(1000).optional().nullable(),
});

export const updateBlockedSlotSchema = createBlockedSlotSchema.partial().omit({ doctorId: true });

export const blockedSlotIdParamSchema = z.object({ id: objectId });

export const blockedListQuerySchema = z.object({
  doctorId: objectId,
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  branchId: objectId.optional(),
});

export const upsertSpecialScheduleSchema = z.object({
  doctorId: objectId,
  branchId: objectId,
  date: z.coerce.date(),
  isWorking: z.boolean().optional(),
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  lunchStart: z.preprocess(emptyToNull, z.string().regex(timeRegex).nullable().optional()),
  lunchEnd: z.preprocess(emptyToNull, z.string().regex(timeRegex).nullable().optional()),
  slotDuration: z.coerce.number().int().min(5).max(240).optional(),
  bufferTime: z.coerce.number().int().min(0).max(120).optional(),
  maximumAppointments: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export const specialScheduleIdParamSchema = z.object({ id: objectId });

export const specialListQuerySchema = z.object({
  doctorId: objectId,
  branchId: objectId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
