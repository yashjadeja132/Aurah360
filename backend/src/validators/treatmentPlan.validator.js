import { z } from 'zod';
import {
  CONSENT_TYPE_LIST,
  TREATMENT_CATEGORIES,
  TREATMENT_PLAN_PRIORITY_LIST,
  TREATMENT_PLAN_STATUS_LIST,
} from '../enums/treatmentPlan.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

export const planItemSchema = z.object({
  serviceId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  procedureName: z.string().min(1).max(200),
  sessionCount: z.coerce.number().int().min(1).optional(),
  sessionDuration: z.coerce.number().int().min(1).optional(),
  frequency: z.string().max(200).optional().nullable(),
  deviceRequired: z.string().max(200).optional().nullable(),
  roomRequired: z.string().max(200).optional().nullable(),
  technicianRequired: z.boolean().optional(),
  consumables: z.union([z.array(z.string()), z.string()]).optional(),
  preInstructions: z.string().max(2000).optional().nullable(),
  postInstructions: z.string().max(2000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  protocolId: z.preprocess(emptyToNull, objectId.nullable().optional()),
});

const goalsSchema = z
  .object({
    expectedResults: z.string().max(2000).optional().nullable(),
    clinicalObjectives: z.string().max(2000).optional().nullable(),
    beforePhotosReference: z.string().max(500).optional().nullable(),
    reviewDate: z.coerce.date().optional().nullable(),
  })
  .optional();

const followUpSchema = z
  .object({
    reviewAfterDays: z.coerce.number().int().min(0).optional().nullable(),
    reviewAfterSession: z.coerce.number().int().min(1).optional().nullable(),
  })
  .optional();

export const createTreatmentPlanSchema = z.object({
  consultationId: objectId,
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(TREATMENT_CATEGORIES).optional(),
  clinicalGoal: z.string().max(2000).optional().nullable(),
  estimatedDuration: z.string().max(100).optional().nullable(),
  estimatedSessions: z.coerce.number().int().min(1).optional(),
  priority: z.enum(TREATMENT_PLAN_PRIORITY_LIST).optional(),
  remarks: z.string().max(2000).optional().nullable(),
  diagnosisSummary: z.string().max(2000).optional().nullable(),
  protocolId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  items: z.array(planItemSchema).optional(),
  goals: goalsSchema,
  followUp: followUpSchema,
});

export const updateTreatmentPlanSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(TREATMENT_CATEGORIES).optional(),
  clinicalGoal: z.string().max(2000).optional().nullable(),
  estimatedDuration: z.string().max(100).optional().nullable(),
  estimatedSessions: z.coerce.number().int().min(1).optional(),
  priority: z.enum(TREATMENT_PLAN_PRIORITY_LIST).optional(),
  remarks: z.string().max(2000).optional().nullable(),
  diagnosisSummary: z.string().max(2000).optional().nullable(),
  items: z.array(planItemSchema).optional(),
  goals: goalsSchema,
  followUp: followUpSchema,
});

export const treatmentPlanIdParamSchema = z.object({ id: objectId });
export const consultationIdParamSchema = z.object({ consultationId: objectId });
export const patientIdParamSchema = z.object({ patientId: objectId });
export const consentIdParamSchema = z.object({
  id: objectId,
  consentId: objectId,
});

export const doctorQuerySchema = z.object({
  doctorId: objectId,
  status: z.enum(TREATMENT_PLAN_STATUS_LIST).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const applyProtocolSchema = z.object({
  protocolId: objectId,
});

export const applyPackageSchema = z.object({
  packageId: objectId,
});

export const rejectPlanSchema = z.object({
  reason: z.string().max(1000).optional().nullable(),
});

export const transferPackageOwnershipSchema = z.object({
  targetBranchId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid branch id'),
  reason: z.string().min(1, 'A reason is required to transfer this package').max(1000),
});

export const acceptConsentSchema = z.object({
  signatureData: z.string().max(5000).optional().nullable(),
  signedByName: z.string().max(200).optional().nullable(),
  witnessName: z.string().max(200).optional().nullable(),
});

export const protocolListQuerySchema = z.object({
  search: z.string().optional(),
  category: z.enum(TREATMENT_CATEGORIES).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createProtocolSchema = z.object({
  protocolCode: z.string().max(50).optional(),
  name: z.string().min(1).max(200),
  category: z.enum(TREATMENT_CATEGORIES).optional(),
  description: z.string().max(2000).optional().nullable(),
  clinicalGoal: z.string().max(2000).optional().nullable(),
  estimatedDuration: z.string().max(100).optional().nullable(),
  estimatedSessions: z.coerce.number().int().min(1).optional(),
  items: z.array(planItemSchema).optional(),
  defaultConsents: z.array(z.enum(CONSENT_TYPE_LIST)).optional(),
  isActive: z.boolean().optional(),
});

export const updateProtocolSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: z.enum(TREATMENT_CATEGORIES).optional(),
  description: z.string().max(2000).optional().nullable(),
  defaultConsents: z.array(z.enum(CONSENT_TYPE_LIST)).optional(),
  isActive: z.boolean().optional(),
});

// Clinical-content changes (items/parameters/consumables/instructions/eligibility) — goes
// through createNewProtocolVersion() instead of mutating the existing document in place.
export const createProtocolVersionSchema = createProtocolSchema.partial();

export const createPackageSchema = z.object({
  packageCode: z.string().max(50).optional(),
  name: z.string().min(1).max(200),
  category: z.enum(TREATMENT_CATEGORIES).optional(),
  description: z.string().max(2000).optional().nullable(),
  packagePrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).optional(),
  validityDays: z.coerce.number().int().min(1).optional(),
  maximumSessions: z.coerce.number().int().min(1),
  protocolId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  isActive: z.boolean().optional(),
});

export const updatePackageSchema = createPackageSchema.partial();
