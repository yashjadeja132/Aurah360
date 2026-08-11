import { z } from 'zod';
import { GENDER } from '../enums/gender.js';
import {
  BLOOD_GROUP_LIST,
  MARITAL_STATUS_LIST,
  DOCUMENT_CATEGORY_LIST,
  DOCUMENT_SOURCE_LIST,
  PATIENT_SOURCE_CATEGORY_LIST,
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
    /** RX-SAFETY — "No Known Drug Allergies" positive confirmation (see Patient.model.js). */
    noKnownDrugAllergies: z.coerce.boolean().optional(),
    allergiesConfirmedAt: z.coerce.date().optional().nullable(),
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
  /** LOY Flow C — referring patient's code, resolved by ReferralService.registerReferral. */
  referralCode: z.string().trim().max(20).optional().nullable(),
  /** True when reception/staff typed the code in on the patient's behalf (audited); false/absent
   *  for a patient supplying their own code (self-service, not audited). */
  referralCreatedByStaff: z.boolean().optional(),
  /**
   * PAT-003 / PAT-005 — `validate()` replaces req.body with the PARSED object, so a field the
   * schema does not mention is not merely unvalidated, it is deleted. Patient.model.js has carried
   * these columns (and toSafeObject() has echoed them back as null) all along, so every referral
   * attribution and every guardian record posted to the API was silently discarded here.
   */
  sourceCategory: z.preprocess(
    emptyToNull,
    z.enum(PATIENT_SOURCE_CATEGORY_LIST).nullable().optional()
  ),
  campaign: z.string().max(200).optional().nullable().transform(emptyToNull),
  isDependent: z.coerce.boolean().optional(),
  guardianPatientId: z.preprocess(emptyToNull, objectId.nullable().optional()),
  guardianName: z.string().max(120).optional().nullable().transform(emptyToNull),
  guardianRelationship: z.string().max(80).optional().nullable().transform(emptyToNull),
  guardianPhone: z.string().max(20).optional().nullable().transform(emptyToNull),
  registrationDate: z.coerce.date().optional(),
  isVip: z.boolean().optional(),
  isBlacklisted: z.boolean().optional(),
  tags: z.array(z.string().max(40)).optional(),
  consent: consentSchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  patientCode: z.string().max(40).optional().nullable(),
  /**
   * PAT-DUP — deliberate override of server-side duplicate detection. Not a patient attribute:
   * PatientService#create consumes it and never persists it. Families genuinely share a phone
   * number, so the check must be overridable rather than a hard block.
   */
  allowDuplicate: z.coerce.boolean().optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const updateConsentSchema = consentSchema;

/**
 * PAT-005 — the ONLY schema in which `guardianVerified` is accepted, and it is bound to a
 * staff-authenticated PATCH /patients/:id/guardian-verification. It is deliberately absent from
 * create/update: `validate()` deletes unlisted keys, so a patient/guardian cannot self-assert it.
 */
export const guardianVerificationSchema = z.object({
  verified: z.coerce.boolean(),
  note: z.string().max(500).optional().nullable(),
});

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
  /**
   * DOC-001 — the date printed ON the report, never the upload date. A report cannot be dated in
   * the future, and accepting one silently corrupts the ordering of the clinical timeline.
   *
   * The tolerance is deliberate, not slack: the browser sends a bare `YYYY-MM-DD`, which coerces to
   * MIDNIGHT UTC of that day. Staff in IST (UTC+5:30) picking "today" before 05:30 local therefore
   * produce an instant that is genuinely in the future in UTC terms. One day of tolerance absorbs
   * every real timezone offset (max ±14h) while still rejecting the dates that actually indicate a
   * mistyped year or a mis-set device clock.
   */
  clinicalDate: z.coerce
    .date()
    .refine((d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, {
      message: 'Clinical/report date cannot be in the future',
    }),
  /** Was a free string while the model enforces an enum — an off-list value reached Mongoose and
   *  failed there as a 500 instead of a 400 naming the field. */
  source: z.enum(DOCUMENT_SOURCE_LIST).optional(),
  relatedVisitId: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable(),
  branchId: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable(),
  /** DOC-002 — id of the document this upload replaces; the service bumps `version` from it.
   *  Must be listed here or `validate()` strips it before it reaches the service. */
  supersedesDocumentId: z.string().regex(/^[a-f\d]{24}$/i).optional().nullable(),
  /**
   * §5 (Documents at front desk) — patient visibility is chosen at Save, not only after the
   * fact via a separate release action. RELEASED is deliberately excluded here: front desk may
   * only ask for doctor approval before release, never publish directly to the patient, so an
   * un-reviewed upload can't be self-releasing.
   */
  patientVisibility: z.enum(['HIDDEN', 'RELEASE_ON_APPROVAL']).optional(),
});

export const renameDocumentSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  /** DOC-003 — a metadata correction must be explainable, so the reason is recorded in the audit. */
  reason: z.string().min(1).max(500).trim().optional(),
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
