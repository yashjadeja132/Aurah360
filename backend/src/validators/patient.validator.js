import { z } from 'zod';
import { GENDER } from '../enums/gender.js';
import {
  BLOOD_GROUP_LIST,
  MARITAL_STATUS_LIST,
  DOCUMENT_CATEGORY_LIST,
} from '../enums/patient.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const emptyToNull = (v) => (v === '' || v === undefined ? null : v);

const addressSchema = z
  .object({
    addressLine1: z.string().max(200).optional().nullable(),
    addressLine2: z.string().max(200).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
    postalCode: z.string().max(20).optional().nullable(),
  })
  .optional();

const emergencySchema = z
  .object({
    name: z.string().max(120).optional().nullable(),
    relationship: z.string().max(80).optional().nullable(),
    phone: z.string().max(20).optional().nullable(),
  })
  .optional();

const medicalSchema = z
  .object({
    heightCm: z.coerce.number().min(0).max(300).optional().nullable(),
    weightKg: z.coerce.number().min(0).max(500).optional().nullable(),
    allergies: z.string().max(2000).optional().nullable(),
    chronicDiseases: z.string().max(2000).optional().nullable(),
    pastMedicalHistory: z.string().max(4000).optional().nullable(),
    pastSurgicalHistory: z.string().max(4000).optional().nullable(),
    currentMedications: z.string().max(2000).optional().nullable(),
    smoking: z.string().max(100).optional().nullable(),
    alcohol: z.string().max(100).optional().nullable(),
    pregnancyStatus: z.string().max(100).optional().nullable(),
    generalNotes: z.string().max(4000).optional().nullable(),
  })
  .optional();

const consentSchema = z.object({
  privacyPolicy: z.boolean().optional(),
  treatmentConsent: z.boolean().optional(),
  photographyConsent: z.boolean().optional(),
  marketingConsent: z.boolean().optional(),
  eSignPlaceholder: z.string().max(500).optional().nullable(),
});

export const createPatientSchema = z.object({
  firstName: z.string().min(1).max(80).trim(),
  middleName: z.string().max(80).optional().nullable().transform(emptyToNull),
  lastName: z.string().min(1).max(80).trim(),
  gender: z.enum([GENDER.MALE, GENDER.FEMALE, GENDER.OTHER, GENDER.PREFER_NOT_TO_SAY]),
  dateOfBirth: z.coerce.date().optional().nullable(),
  bloodGroup: z.preprocess(
    (v) => (v === '' || v == null ? null : v),
    z.enum(BLOOD_GROUP_LIST).nullable().optional()
  ),
  maritalStatus: z.preprocess(
    (v) => (v === '' || v == null ? null : v),
    z.enum(MARITAL_STATUS_LIST).nullable().optional()
  ),
  photo: z.string().optional().nullable(),
  mobile: z.string().min(8).max(20).trim(),
  alternateMobile: z.string().max(20).optional().nullable().transform(emptyToNull),
  email: z.preprocess(
    emptyToNull,
    z.string().email().nullable().optional()
  ),
  preferredLanguage: z.string().max(40).optional(),
  occupation: z.string().max(120).optional().nullable(),
  nationality: z.string().max(80).optional().nullable(),
  address: addressSchema,
  emergencyContact: emergencySchema,
  medical: medicalSchema,
  primaryBranchId: objectId,
  primaryDoctorId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  leadSourceId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  referredBy: z.string().max(200).optional().nullable(),
  registrationDate: z.coerce.date().optional(),
  isVip: z.boolean().optional(),
  isBlacklisted: z.boolean().optional(),
  tags: z.array(z.string().max(40)).optional(),
  consent: consentSchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  patientCode: z.string().max(40).optional().nullable(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const updateConsentSchema = consentSchema;

export const listPatientQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  isVip: z.enum(['true', 'false']).optional(),
  gender: z.enum([GENDER.MALE, GENDER.FEMALE, GENDER.OTHER, GENDER.PREFER_NOT_TO_SAY]).optional(),
  branchId: objectId.optional(),
  primaryBranchId: objectId.optional(),
  doctorId: objectId.optional(),
  primaryDoctorId: objectId.optional(),
  leadSourceId: objectId.optional(),
  tag: z.string().optional(),
  registeredFrom: z.string().optional(),
  registeredTo: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const patientIdParamSchema = z.object({ id: objectId });

export const documentIdParamSchema = z.object({
  id: objectId,
  documentId: objectId,
});

export const uploadDocumentSchema = z.object({
  category: z.enum(DOCUMENT_CATEGORY_LIST),
  title: z.string().max(200).optional(),
  notes: z.string().max(1000).optional().nullable(),
  clinicalDate: z.coerce.date(),
  source: z.string().max(30).optional(),
  relatedVisitId: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable(),
  branchId: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable(),
});

export const renameDocumentSchema = z.object({
  title: z.string().min(1).max(200).trim(),
});

export const reviewDocumentSchema = z.object({
  reviewState: z.enum(['UNREVIEWED', 'REVIEWED', 'CLARIFICATION_NEEDED', 'SUPERSEDED']),
  reviewComment: z.string().max(1000).optional().nullable(),
});

export const releaseDocumentSchema = z.object({
  visibility: z.enum(['HIDDEN', 'RELEASED', 'RELEASE_ON_APPROVAL']),
});

export const duplicateCheckSchema = z.object({
  mobile: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.coerce.date().optional(),
  excludeId: objectId.optional(),
});

export const mergePlaceholderSchema = z.object({
  primaryId: objectId,
  duplicateId: objectId,
});
