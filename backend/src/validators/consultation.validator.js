import { z } from 'zod';
import {
  CONSULTATION_STATUS_LIST,
  PHOTO_TYPE_LIST,
  TEMPLATE_TYPE_LIST,
  FOLLOW_UP_UNIT_LIST,
} from '../enums/consultation.js';

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
    })
    .optional(),
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

export const photoMetaSchema = z.object({
  photoType: z.enum(PHOTO_TYPE_LIST).optional(),
  title: z.string().max(200).optional().nullable(),
  bodyRegion: z.string().max(100).optional().nullable(),
  consentVerified: z
    .preprocess((v) => v === true || v === 'true' || v === '1', z.boolean())
    .optional(),
});

export const templateCreateSchema = z.object({
  doctorId: objectId,
  name: z.string().min(1).max(200),
  templateType: z.enum(TEMPLATE_TYPE_LIST),
  content: z.record(z.any()).optional(),
  isShared: z.boolean().optional(),
});

export const doctorListQuerySchema = z.object({
  doctorId: objectId,
  status: z.enum(CONSULTATION_STATUS_LIST).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const templateListQuerySchema = z.object({
  doctorId: objectId,
  templateType: z.enum(TEMPLATE_TYPE_LIST).optional(),
});

export const aiStubSchema = z.object({
  context: z.record(z.any()).optional(),
});

export const releaseSummarySchema = z.object({
  summary: z.string().min(1).max(4000),
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

export { objectId, emptyToNull };
