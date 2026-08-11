import { z } from 'zod';
import {
  DOSAGE_FORM_LIST,
  INTERACTION_MATCH_ON_LIST,
  INTERACTION_SEVERITY_LIST,
  MEDICINE_ROUTE_LIST,
  PRESCRIPTION_STATUS_LIST,
} from '../enums/prescription.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

export const medicineItemSchema = z.object({
  medicineId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  medicineName: z.string().min(1).max(200).optional(),
  genericName: z.string().max(200).optional().nullable(),
  strength: z.string().max(100).optional().nullable(),
  dosage: z.string().max(100).optional().nullable(),
  frequency: z.string().max(100).optional().nullable(),
  duration: z.string().max(100).optional().nullable(),
  route: z.enum(MEDICINE_ROUTE_LIST).optional(),
  instructions: z.string().max(1000).optional().nullable(),
  quantity: z.coerce.number().min(0).optional().nullable(),
  morning: z.boolean().optional(),
  afternoon: z.boolean().optional(),
  night: z.boolean().optional(),
  beforeFood: z.boolean().optional(),
  afterFood: z.boolean().optional(),
  remarks: z.string().max(500).optional().nullable(),
  // Spec §3.3 — "{Substitution note if allowed}"; prescriber-authored, distinct from the
  // pharmacy dispense-time substitution mechanism (PharmacyService).
  substitutionAllowed: z.boolean().optional(),
  substitutionNote: z.string().max(500).optional().nullable(),
});

export const createPrescriptionSchema = z.object({
  consultationId: objectId,
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(medicineItemSchema).min(1),
});

export const updatePrescriptionSchema = z.object({
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(medicineItemSchema).min(1).optional(),
});

export const prescriptionIdParamSchema = z.object({ id: objectId });
export const consultationIdParamSchema = z.object({ consultationId: objectId });
export const patientIdParamSchema = z.object({ patientId: objectId });

// SEC-030 — doctorId optional; a DOCTOR's own id is resolved server-side from their token and
// the controller still requires a resolvable one (see scope.helper.js).
export const doctorQuerySchema = z.object({
  doctorId: objectId.optional(),
  branchId: objectId.optional(),
  status: z.enum(PRESCRIPTION_STATUS_LIST).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const medicineSearchQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const medicineListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  isActive: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const createMedicineSchema = z.object({
  medicineCode: z.string().max(50).optional(),
  name: z.string().min(1).max(200),
  genericName: z.string().max(200).optional().nullable(),
  brand: z.string().max(200).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  strength: z.string().max(100).optional().nullable(),
  dosageForm: z.enum(DOSAGE_FORM_LIST).optional().nullable(),
  defaultRoute: z.enum(MEDICINE_ROUTE_LIST).optional().nullable(),
  manufacturer: z.string().max(200).optional().nullable(),
  mrp: z.coerce.number().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateMedicineSchema = createMedicineSchema.partial();

export const templateCreateSchema = z.object({
  doctorId: objectId,
  name: z.string().min(1).max(200),
  isFavorite: z.boolean().optional(),
  medicineId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  items: z.array(medicineItemSchema).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export const applyTemplateSchema = z.object({
  consultationId: objectId,
});

/**
 * RX-SAFETY — finalize body. `override.reason` is the only way past a blocking allergy/interaction
 * alert and is meaningless without substance, so a minimum length is enforced here rather than
 * accepting " " and writing it to the audit trail.
 */
export const finalizePrescriptionSchema = z.object({
  override: z
    .object({
      reason: z.string().trim().min(10).max(1000),
    })
    .optional(),
});

export const createInteractionRuleSchema = z.object({
  ruleCode: z.string().max(60).optional(),
  termA: z.string().min(3).max(120),
  termB: z.string().min(3).max(120),
  matchOnA: z.enum(INTERACTION_MATCH_ON_LIST).optional(),
  matchOnB: z.enum(INTERACTION_MATCH_ON_LIST).optional(),
  severity: z.enum(INTERACTION_SEVERITY_LIST).optional(),
  blocking: z.boolean().optional(),
  clinicalEffect: z.string().max(1000).optional().nullable(),
  management: z.string().max(1000).optional().nullable(),
  sourceReference: z.string().max(300).optional().nullable(),
});

export const updateInteractionRuleSchema = z.object({
  isActive: z.boolean(),
});
