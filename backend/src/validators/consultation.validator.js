import { z } from 'zod';
import {
  CONSULTATION_STATUS_LIST,
  PHOTO_TYPE_LIST,
  TEMPLATE_TYPE_LIST,
  TEMPLATE_STATUS_LIST,
  FOLLOW_UP_UNIT_LIST,
  FOLLOW_UP_PRIORITY_LIST,
  CONTENT_CLASSIFICATION_LIST,
  INTAKE_CATEGORY_LIST,
  SKIN_TYPE_LIST,
  DURATION_UNIT_LIST,
} from '../enums/consultation.js';
import { PATIENT_VISIBILITY_LIST } from '../enums/patient.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

export const consultationIdParamSchema = z.object({ id: objectId });
export const patientIdParamSchema = z.object({ patientId: objectId });
export const photoIdParamSchema = z.object({ photoId: objectId });

export const startConsultationSchema = z.object({
  appointmentId: objectId,
  chiefComplaint: z.string().max(1000).optional().nullable(),
});

export const updateConsultationSchema = z.object({
  chiefComplaint: z.string().max(1000).optional().nullable(),
  status: z.literal('COMPLETED').optional(),
  followUp: z
    .object({
      value: z.coerce.number().int().min(1).max(365).optional().nullable(),
      unit: z.enum(FOLLOW_UP_UNIT_LIST).optional().nullable(),
      reason: z.string().max(500).optional().nullable(),
      instructions: z.string().max(2000).optional().nullable(),
      priority: z.enum(FOLLOW_UP_PRIORITY_LIST).optional().nullable(),
      preferredDoctorId: objectId.optional().nullable(),
      preferredBranchId: objectId.optional().nullable(),
      reminderDate: z.coerce.date().optional().nullable(),
      reminderNote: z.string().max(500).optional().nullable(),
    })
    .optional(),
});

/** §5 — mark a follow-up done/rescheduled from the cross-patient Follow-ups list. */
export const followUpActionSchema = z.object({
  status: z.enum(['PENDING', 'DONE', 'RESCHEDULED']),
  reminderDate: z.coerce.date().optional().nullable(),
  reminderNote: z.string().max(500).optional().nullable(),
});

/** §5 — cross-patient Follow-ups due/overdue list filters. */
export const followUpQueueQuerySchema = z.object({
  doctorId: objectId.optional(),
  branchId: objectId.optional(),
  status: z.enum(['PENDING', 'DONE', 'RESCHEDULED']).optional(),
  scope: z.enum(['DUE', 'ALL']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const soapAutosaveSchema = z.object({
  subjective: z.string().max(50000).optional(),
  objective: z.string().max(50000).optional(),
  assessment: z.string().max(50000).optional(),
  plan: z.string().max(50000).optional(),
});

export const vitalsSchema = z.object({
  heightCm: z.coerce.number().min(0).max(300).optional().nullable(),
  weightKg: z.coerce.number().min(0).max(500).optional().nullable(),
  bmi: z.coerce.number().min(0).max(100).optional().nullable(),
  temperatureC: z.coerce.number().min(30).max(45).optional().nullable(),
  pulseBpm: z.coerce.number().int().min(0).max(300).optional().nullable(),
  bloodPressureSystolic: z.coerce.number().int().min(0).max(300).optional().nullable(),
  bloodPressureDiastolic: z.coerce.number().int().min(0).max(200).optional().nullable(),
  respirationRpm: z.coerce.number().int().min(0).max(100).optional().nullable(),
  oxygenSaturation: z.coerce.number().min(0).max(100).optional().nullable(),
  painScale: z.coerce.number().int().min(0).max(10).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const diagnosisSchema = z.object({
  primaryDiagnosis: z.string().max(500).optional().nullable(),
  secondaryDiagnoses: z.array(z.string().max(500)).optional(),
  clinicalNotes: z.string().max(5000).optional().nullable(),
  icd10Codes: z.array(z.string().max(20)).optional(),
});

export const examinationSchema = z.object({
  generalExamination: z.string().max(10000).optional(),
  skinExamination: z.string().max(10000).optional(),
  hairExamination: z.string().max(10000).optional(),
  scalpExamination: z.string().max(10000).optional(),
  laserAssessment: z.string().max(10000).optional(),
  clinicalFindings: z.string().max(10000).optional(),
});

/** §2 Pre-consult intake — PUT is a partial merge (mirrors vitalsSchema/examinationSchema: every
 * field optional, service merges onto the existing row) so autosave can fire on every keystroke. */
export const intakeSchema = z.object({
  category: z.enum(INTAKE_CATEGORY_LIST).optional(),
  chiefComplaint: z.string().max(1000).optional().nullable(),
  durationValue: z.coerce.number().min(0).max(1000).optional().nullable(),
  durationUnit: z.enum(DURATION_UNIT_LIST).optional().nullable(),
  bodyArea: z.string().max(300).optional().nullable(),
  allergies: z.string().max(2000).optional().nullable(),
  allergiesReviewed: z.boolean().optional(),
  currentMedications: z.string().max(2000).optional().nullable(),
  currentMedicationsReviewed: z.boolean().optional(),
  conditions: z.string().max(2000).optional().nullable(),
  conditionsReviewed: z.boolean().optional(),
  pastTreatment: z.string().max(2000).optional().nullable(),
  pastTreatmentReviewed: z.boolean().optional(),
  skinHistory: z
    .object({
      skinType: z.enum(SKIN_TYPE_LIST).optional().nullable(),
      photosensitivity: z.boolean().optional().nullable(),
      photosensitivityNotes: z.string().max(1000).optional().nullable(),
      scarKeloidTendency: z.boolean().optional().nullable(),
      isotretinoinHistory: z.boolean().optional().nullable(),
      isotretinoinNotes: z.string().max(1000).optional().nullable(),
      pregnancyLactation: z.boolean().optional().nullable(),
      priorReactions: z.string().max(2000).optional().nullable(),
      contraindications: z.string().max(2000).optional().nullable(),
    })
    .optional(),
});

export const photoMetaSchema = z.object({
  photoType: z.enum(PHOTO_TYPE_LIST).optional(),
  title: z.string().max(200).optional().nullable(),
  bodyRegion: z.string().max(100).optional().nullable(),
  consentVerified: z
    .preprocess((v) => v === true || v === 'true' || v === '1', z.boolean())
    .optional(),
});

/**
 * IMG-005 — doctor-controlled release of a clinical photo to the patient portal.
 * `visibility` MUST be listed here: `validate()` replaces the body with the parsed result, so a
 * field absent from the schema never reaches the service.
 */
export const releasePhotoSchema = z.object({
  visibility: z.enum(PATIENT_VISIBILITY_LIST),
});

export const templateCreateSchema = z.object({
  doctorId: objectId,
  name: z.string().min(1).max(200),
  templateType: z.enum(TEMPLATE_TYPE_LIST),
  content: z.record(z.any()).optional(),
  isShared: z.boolean().optional(),
});

// SEC-030 — optional: a DOCTOR's own id is resolved server-side from their token. The
// controller still requires a resolvable doctorId, so other roles must supply one as before.
export const doctorListQuerySchema = z.object({
  doctorId: objectId.optional(),
  branchId: objectId.optional(),
  status: z.enum(CONSULTATION_STATUS_LIST).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const templateListQuerySchema = z.object({
  doctorId: objectId,
  templateType: z.enum(TEMPLATE_TYPE_LIST).optional(),
});

/** Settings → Masters admin listing — unscoped (no required doctorId), paginated/searchable. */
export const templateAdminListQuerySchema = z.object({
  doctorId: objectId.optional(),
  templateType: z.enum(TEMPLATE_TYPE_LIST).optional(),
  status: z.enum(TEMPLATE_STATUS_LIST).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const templateUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  templateType: z.enum(TEMPLATE_TYPE_LIST).optional(),
  content: z.record(z.any()).optional(),
  isShared: z.boolean().optional(),
});

export const aiStubSchema = z.object({
  context: z.record(z.any()).optional(),
});

// §3.7 — per-section classification. `summary` stays accepted for back-compat callers (treated
// as one PATIENT_FACING section server-side); new callers send `sections`.
export const releaseSummarySchema = z
  .object({
    summary: z.string().min(1).max(4000).optional(),
    sections: z
      .array(
        z.object({
          key: z.string().min(1).max(100),
          label: z.string().max(200).optional().nullable(),
          text: z.string().max(4000).optional().default(''),
          classification: z.enum(CONTENT_CLASSIFICATION_LIST).optional(),
        })
      )
      .min(1)
      .optional(),
  })
  .refine((v) => Boolean(v.summary) || Boolean(v.sections), {
    message: 'Either summary or sections is required',
  });

export const amendConsultationSchema = z.object({
  text: z.string().min(1).max(4000),
  reason: z.string().min(1).max(500),
});

export const createLabOrderSchema = z.object({
  testName: z.string().min(1).max(200),
  reason: z.string().max(500).optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  provider: z.string().max(120).optional().nullable(),
});

export const updateLabOrderSchema = z.object({
  status: z.enum(['ORDERED', 'RESULT_RECEIVED', 'REVIEWED', 'CANCELLED']).optional(),
  resultDocumentId: objectId.optional().nullable(),
  reviewComment: z.string().max(1000).optional().nullable(),
});

export const labOrderIdParamSchema = z.object({ labOrderId: objectId });

/** A13 — cross-patient Report Review worklist filters. */
export const labOrderReviewQueueQuerySchema = z.object({
  status: z.enum(['ORDERED', 'RESULT_RECEIVED', 'REVIEWED', 'CANCELLED']).optional(),
  patientId: objectId.optional(),
  doctorId: objectId.optional(),
  branchId: objectId.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export { objectId, emptyToNull };
