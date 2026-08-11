import { z } from 'zod';
import { QUEUE_PRIORITY_LIST } from '../enums/queue.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

/**
 * `branchId` is optional: the controller resolves it via `resolveBranchScope`, which pins a
 * non-global role to its own branch and refuses a request for someone else's. Requiring it here
 * was a usability trap — a RECEPTIONIST cannot call `GET /branches` (no `branches.view`), so the
 * client had no way to discover the id it was being forced to supply.
 */
export const receptionDashboardQuerySchema = z.object({
  branchId: objectId.optional(),
  date: z.string().optional(),
});

export const todaysAppointmentsQuerySchema = z.object({
  branchId: objectId.optional(),
  doctorId: objectId.optional(),
  date: z.string().optional(),
  search: z.string().optional(),
});

export const appointmentIdParamSchema = z.object({
  appointmentId: objectId,
});

export const checkInSchema = z.object({
  priority: z.enum(QUEUE_PRIORITY_LIST).optional(),
  receptionNotes: z.string().max(2000).optional().nullable(),
  /** Intake symptoms typed by reception — becomes the consultation's chief complaint. */
  symptoms: z.string().max(2000).optional().nullable(),
  updateContact: z
    .object({
      mobile: z.string().min(8).max(20).optional(),
      email: z.string().email().optional().nullable(),
      alternateMobile: z.string().min(8).max(20).optional().nullable(),
    })
    .optional(),
  consent: z
    .object({
      privacyPolicy: z.boolean().optional(),
      treatmentConsent: z.boolean().optional(),
      photographyConsent: z.boolean().optional(),
      marketingConsent: z.boolean().optional(),
    })
    .optional(),
});

export const walkInSchema = z.object({
  patientId: objectId,
  doctorId: objectId,
  branchId: objectId,
  serviceId: objectId,
  departmentId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  appointmentDate: z.coerce.date().optional(),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  appointmentType: z.string().optional(),
  appointmentPriority: z.string().optional(),
  reasonForVisit: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  queuePriority: z.enum(QUEUE_PRIORITY_LIST).optional(),
  receptionNotes: z.string().max(2000).optional().nullable(),
  symptoms: z.string().max(2000).optional().nullable(),
  updateContact: checkInSchema.shape.updateContact,
  consent: checkInSchema.shape.consent,
});
