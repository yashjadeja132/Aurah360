import { z } from 'zod';
import { TREATMENT_SESSION_STATUS_LIST } from '../enums/treatmentSession.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

const deviceUsageSchema = z
  .object({
    device: z.string().max(200).optional().nullable(),
    machine: z.string().max(200).optional().nullable(),
    laserHead: z.string().max(200).optional().nullable(),
    settings: z.record(z.any()).optional(),
  })
  .optional();

/**
 * TRT-006 — answers to TreatmentProtocol.contraindicationQuestions. `answer: true` means the
 * contraindication IS present (a hard stop); null means "not yet answered", which is itself a stop.
 */
const contraindicationScreeningSchema = z
  .object({
    answers: z
      .array(
        z.object({
          question: z.string().min(1).max(500),
          answer: z.boolean().nullable().optional(),
          note: z.string().max(1000).optional().nullable(),
        })
      )
      .default([]),
  })
  .optional()
  .nullable();

const followUpSchema = z
  .object({
    nextSessionDate: z.coerce.date().optional().nullable(),
    reviewDate: z.coerce.date().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .optional();

export const createSessionSchema = z.object({
  treatmentPlanId: objectId,
  invoiceId: objectId,
  appointmentId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  technicianId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  protocolId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  scheduledDate: z.coerce.date().optional().nullable(),
  roomId: z.string().max(100).optional().nullable(),
  deviceId: z.string().max(100).optional().nullable(),
  /** TRT-003 — real Room/Device references; the ROOM/DEVICE hard stops evaluate against these. */
  roomRef: z.preprocess(emptyToNull, objectId.nullable().optional()),
  deviceRef: z.preprocess(emptyToNull, objectId.nullable().optional()),
  remarks: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  followUp: followUpSchema,
});

export const updateSessionSchema = z.object({
  technicianId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  appointmentId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  scheduledDate: z.coerce.date().optional().nullable(),
  roomId: z.string().max(100).optional().nullable(),
  deviceId: z.string().max(100).optional().nullable(),
  roomRef: z.preprocess(emptyToNull, objectId.nullable().optional()),
  deviceRef: z.preprocess(emptyToNull, objectId.nullable().optional()),
  remarks: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  complications: z.string().max(2000).optional().nullable(),
  outcome: z.string().max(2000).optional().nullable(),
  consumables: z.union([z.array(z.string()), z.string()]).optional(),
  deviceUsage: deviceUsageSchema,
  contraindicationScreening: contraindicationScreeningSchema,
  followUp: followUpSchema,
});

export const startSessionSchema = z.object({
  technicianId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  operatorName: z.string().max(200).optional().nullable(),
  deviceUsage: deviceUsageSchema,
  consumables: z.array(z.string()).optional(),
  contraindicationScreening: contraindicationScreeningSchema,
  /** TRT-006 — authorized hard-stop override with mandatory reason. */
  override: z.object({ reason: z.string().min(1).max(500) }).optional().nullable(),
});

export const completeSessionSchema = z.object({
  duration: z.coerce.number().int().min(0).optional(),
  complications: z.string().max(2000).optional().nullable(),
  outcome: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  consumables: z.array(z.string()).optional(),
  deviceUsage: deviceUsageSchema,
  followUp: followUpSchema,
});

export const rescheduleSchema = z.object({
  scheduledDate: z.coerce.date(),
});

export const reverseCompletionSchema = z.object({
  reason: z.string().min(1).max(500),
});

/**
 * IMG-003 — metadata for a session photo upload (multipart body, so validated after multer).
 * `bodyRegion` stays free text (see helpers/bodyRegion.helper.js); the restricted-area policy is
 * enforced server-side by ClinicalPhotoPolicyService, not by this schema. A caller-supplied
 * `consentVerified` is deliberately NOT accepted here — consent is read from the ConsentGrant log.
 */
export const sessionPhotoMetaSchema = z.object({
  // Case-insensitive, matching the service's existing tolerance for "after"/"AFTER".
  photoType: z
    .preprocess((v) => (typeof v === 'string' ? v.toUpperCase() : v), z.enum(['BEFORE', 'AFTER']))
    .optional(),
  title: z.string().max(200).optional().nullable(),
  bodyRegion: z.string().max(100).optional().nullable(),
});

export const sessionIdParamSchema = z.object({ id: objectId });
export const planIdParamSchema = z.object({ planId: objectId });

export const sessionListQuerySchema = z.object({
  treatmentPlanId: objectId.optional(),
  patientId: objectId.optional(),
  doctorId: objectId.optional(),
  technicianId: objectId.optional(),
  branchId: objectId.optional(),
  status: z.enum(TREATMENT_SESSION_STATUS_LIST).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const dashboardQuerySchema = z.object({
  branchId: objectId.optional(),
  doctorId: objectId.optional(),
});
