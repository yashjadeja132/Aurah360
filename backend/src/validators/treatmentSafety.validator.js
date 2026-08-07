import { z } from 'zod';
import { objectId } from './common.js';

export const recordPatchTestSchema = z.object({
  patientId: objectId,
  treatmentPlanId: objectId.optional().nullable(),
  protocolId: objectId.optional().nullable(),
  productOrSetting: z.string().min(1).max(200),
  testArea: z.string().min(1).max(120),
  reviewDueAt: z.coerce.date(),
});

export const reviewPatchTestSchema = z.object({
  result: z.enum(['PENDING', 'NEGATIVE', 'POSITIVE', 'INCONCLUSIVE']),
  reactionNotes: z.string().max(1000).optional().nullable(),
  validUntil: z.coerce.date().optional().nullable(),
});

export const reportAdverseEventSchema = z.object({
  patientId: objectId,
  treatmentSessionId: objectId.optional().nullable(),
  treatmentPlanId: objectId.optional().nullable(),
  branchId: objectId,
  severity: z.enum(['MILD', 'MODERATE', 'SEVERE', 'LIFE_THREATENING']),
  onsetAt: z.coerce.date(),
  description: z.string().min(1).max(4000),
  treatmentGiven: z.string().max(2000).optional().nullable(),
  responsibleClinicianId: objectId.optional().nullable(),
  followUpPlan: z.string().max(2000).optional().nullable(),
});

export const updateAdverseEventSchema = z.object({
  status: z.enum(['OPEN', 'ESCALATED', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED']).optional(),
  escalatedTo: objectId.optional().nullable(),
  followUpPlan: z.string().max(2000).optional().nullable(),
  treatmentGiven: z.string().max(2000).optional().nullable(),
});

export const closeAdverseEventSchema = z.object({
  closureNotes: z.string().max(2000).optional().nullable(),
});

export const patientIdParamSchema = z.object({ patientId: objectId });
export const idParamSchema = z.object({ id: objectId });

export default {
  recordPatchTestSchema,
  reviewPatchTestSchema,
  reportAdverseEventSchema,
  updateAdverseEventSchema,
  closeAdverseEventSchema,
  patientIdParamSchema,
  idParamSchema,
};
