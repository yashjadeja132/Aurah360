import { z } from 'zod';
import { GENDER } from '../enums/gender.js';
import { LEAVE_STATUS, LEAVE_TYPE } from '../enums/leave.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createDoctorSchema = z.object({
  userId: objectId,
  doctorCode: z.string().min(2).max(30).trim(),
  licenseNumber: z.string().min(2).max(60).trim(),
  registrationNumber: z.string().min(2).max(60).trim(),
  qualification: z.string().max(200).optional().nullable(),
  specialization: z.string().max(200).optional().nullable(),
  experienceYears: z.coerce.number().min(0).max(60).optional(),
  bio: z.string().max(2000).optional().nullable(),
  consultationDuration: z.coerce.number().int().min(5).max(240).optional(),
  consultationFee: z.coerce.number().min(0).optional(),
  followUpFee: z.coerce.number().min(0).optional(),
  departments: z.array(objectId).optional().default([]),
  services: z.array(objectId).optional().default([]),
  branches: z.array(objectId).min(1, 'At least one branch is required'),
  languages: z.array(z.string()).optional(),
  gender: z.enum([
    GENDER.MALE,
    GENDER.FEMALE,
    GENDER.OTHER,
    GENDER.PREFER_NOT_TO_SAY,
  ]).optional().nullable(),
  signatureImage: z.string().optional().nullable(),
  profilePhoto: z.string().optional().nullable(),
  colorCode: z.string().max(20).optional(),
  isAvailableOnline: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateDoctorSchema = createDoctorSchema.partial().omit({ userId: true });

export const listDoctorQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  branchId: objectId.optional(),
  departmentId: objectId.optional(),
  specialization: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const doctorIdParamSchema = z.object({
  id: objectId,
});

export const scheduleIdParamSchema = z.object({
  id: objectId,
  scheduleId: objectId,
});

export const leaveIdParamSchema = z.object({
  id: objectId,
  leaveId: objectId,
});

const scheduleDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  lunchStart: z.string().regex(timeRegex).optional().nullable(),
  lunchEnd: z.string().regex(timeRegex).optional().nullable(),
  slotDuration: z.coerce.number().int().min(5).max(240).optional(),
  bufferTime: z.coerce.number().int().min(0).max(120).optional(),
  maximumAppointments: z.coerce.number().int().min(0).optional(),
  isWorking: z.boolean().optional(),
});

export const upsertScheduleSchema = z.object({
  branchId: objectId,
  days: z.array(scheduleDaySchema).min(1),
});

export const scheduleListQuerySchema = z.object({
  branchId: objectId.optional(),
});

export const previewSlotsQuerySchema = z.object({
  branchId: objectId,
  dayOfWeek: z.coerce.number().int().min(0).max(6),
});

export const availabilityQuerySchema = z.object({
  date: z.string().optional(),
  branchId: objectId.optional(),
});

export const createLeaveSchema = z.object({
  branchId: objectId.optional().nullable(),
  leaveType: z.enum([LEAVE_TYPE.FULL_DAY, LEAVE_TYPE.HALF_DAY, LEAVE_TYPE.CUSTOM]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().max(500).optional().nullable(),
  status: z.enum([
    LEAVE_STATUS.PENDING,
    LEAVE_STATUS.APPROVED,
    LEAVE_STATUS.REJECTED,
    LEAVE_STATUS.CANCELLED,
  ]).optional(),
});

export const updateLeaveSchema = createLeaveSchema.partial();
