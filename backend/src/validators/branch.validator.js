import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const dayScheduleSchema = z.object({
  day: z.number().int().min(0).max(6),
  isClosed: z.boolean().optional(),
  openTime: z.string().regex(timeRegex).optional(),
  closeTime: z.string().regex(timeRegex).optional(),
});

const lunchBreakSchema = z.object({
  enabled: z.boolean().optional(),
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
});

const holidaySchema = z.object({
  date: z.coerce.date(),
  name: z.string().min(1).max(120),
  isRecurring: z.boolean().optional(),
});

const emergencyContactSchema = z.object({
  name: z.string().max(120).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
});

export const branchSettingsSchema = z.object({
  workingDays: z.array(z.number().int().min(0).max(6)).optional(),
  weeklySchedule: z.array(dayScheduleSchema).optional(),
  lunchBreak: lunchBreakSchema.optional(),
  timeSlotDurationMinutes: z.number().int().min(5).max(240).optional(),
  appointmentBufferMinutes: z.number().int().min(0).max(120).optional(),
  holidayCalendar: z.array(holidaySchema).optional(),
  emergencyContact: emergencyContactSchema.optional(),
});

export const createBranchSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  branchCode: z.string().min(2).max(20).trim(),
  displayName: z.string().min(1).max(120).trim(),
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  phone: z.string().min(8).max(20).trim(),
  alternatePhone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  timezone: z.string().max(80).optional(),
  currency: z.string().max(10).optional(),
  logo: z.string().optional().nullable(),
  workingHours: z.string().max(120).optional().nullable(),
  facilities: z.array(z.string().max(60)).max(50).optional(),
  notes: z.string().max(1000).optional().nullable(),
  settings: branchSettingsSchema.optional(),
});

export const updateBranchSchema = createBranchSchema.partial();

export const listBranchQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  city: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const idParamSchema = z.object({
  id: objectId,
});

export const transferBranchSchema = z.object({
  toBranchId: objectId,
});

export const deactivateBranchSchema = z.object({
  reason: z.string().min(3).max(500),
});
