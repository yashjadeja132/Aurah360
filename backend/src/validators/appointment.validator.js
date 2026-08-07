import { z } from 'zod';
import {
  APPOINTMENT_STATUS_LIST,
  APPOINTMENT_TYPE_LIST,
  APPOINTMENT_SOURCE_LIST,
  APPOINTMENT_PRIORITY_LIST,
} from '../enums/appointment.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

export const createAppointmentSchema = z.object({
  patientId: objectId,
  doctorId: objectId,
  branchId: objectId,
  departmentId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  serviceId: objectId,
  appointmentDate: z.coerce.date(),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  duration: z.coerce.number().int().min(1).max(480).optional(),
  appointmentType: z.enum(APPOINTMENT_TYPE_LIST).optional(),
  source: z.enum(APPOINTMENT_SOURCE_LIST).optional(),
  priority: z.enum(APPOINTMENT_PRIORITY_LIST).optional(),
  notes: z.string().max(2000).optional().nullable(),
  reasonForVisit: z.string().max(500).optional().nullable(),
  roomId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  deviceId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  technicianId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  parentAppointmentId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  /** APT-008 — client-supplied idempotency key for safe retries. */
  idempotencyKey: z.string().max(120).optional().nullable(),
  /** APT-003 — patient-proposed/custom slot held as Pending Approval instead of committed. */
  requiresApproval: z.boolean().optional(),
  recurring: z
    .object({
      enabled: z.boolean().optional(),
      frequency: z.string().optional().nullable(),
      interval: z.number().optional().nullable(),
      endDate: z.coerce.date().optional().nullable(),
    })
    .optional(),
});

export const updateAppointmentSchema = createAppointmentSchema.partial();

export const listAppointmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  status: z.enum(APPOINTMENT_STATUS_LIST).optional(),
  doctorId: objectId.optional(),
  patientId: objectId.optional(),
  branchId: objectId.optional(),
  serviceId: objectId.optional(),
  appointmentType: z.enum(APPOINTMENT_TYPE_LIST).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const appointmentIdParamSchema = z.object({ id: objectId });

export const availableSlotsQuerySchema = z.object({
  doctorId: objectId,
  date: z.coerce.date(),
  branchId: objectId,
});

export const cancelAppointmentSchema = z.object({
  reason: z.string().max(500).optional().nullable(),
});

export const rescheduleAppointmentSchema = z.object({
  appointmentDate: z.coerce.date(),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  doctorId: objectId.optional(),
  branchId: objectId.optional(),
  serviceId: objectId.optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const followUpSchema = createAppointmentSchema.pick({
  appointmentDate: true,
  startTime: true,
  endTime: true,
  doctorId: true,
  branchId: true,
  serviceId: true,
  notes: true,
  reasonForVisit: true,
  priority: true,
  roomId: true,
  deviceId: true,
  technicianId: true,
}).partial({
  doctorId: true,
  branchId: true,
  serviceId: true,
});

export const doctorCalendarQuerySchema = z.object({
  doctorId: objectId,
  from: z.coerce.date(),
  to: z.coerce.date(),
  branchId: objectId.optional(),
});

export const patientHistoryParamSchema = z.object({
  patientId: objectId,
});

export const approvalDecisionSchema = z.object({
  decision: z.enum(['ACCEPTED', 'ALTERNATIVE_PROPOSED', 'REJECTED']),
  alternative: z
    .object({
      appointmentDate: z.coerce.date(),
      startTime: z.string().regex(timeRegex),
      endTime: z.string().regex(timeRegex),
    })
    .optional()
    .nullable(),
  reason: z.string().max(500).optional().nullable(),
});

export const waitlistCreateSchema = z.object({
  patientId: objectId,
  doctorId: objectId,
  branchId: objectId,
  serviceId: objectId.optional().nullable(),
  preferredDate: z.coerce.date(),
  preferredWindowStart: z.string().regex(timeRegex).optional().nullable(),
  preferredWindowEnd: z.string().regex(timeRegex).optional().nullable(),
});

export const waitlistOfferSchema = z.object({
  appointmentDate: z.coerce.date(),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
});

export const waitlistQuerySchema = z.object({
  doctorId: objectId.optional(),
  branchId: objectId.optional(),
});

export const waitlistIdParamSchema = z.object({ id: objectId });
