export const CONSULTATION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  SIGNED: 'SIGNED',
  LOCKED: 'LOCKED',
});

export const CONSULTATION_STATUS_LIST = Object.freeze(Object.values(CONSULTATION_STATUS));

/**
 * Doubles as the photo's "purpose" in the capture-guard UI (nurse flow gap fix): PROGRESS and
 * CONSENT_DOCUMENTATION were added to the pre-existing BEFORE/AFTER/BODY_MAP/OTHER set rather
 * than inventing a second parallel field, since photoType was already the closest existing
 * taxonomy and this is an additive enum change (no migration needed — Mongoose enum validation
 * only rejects values, it never touches rows already in a value that stays valid).
 */
export const PHOTO_TYPE = Object.freeze({
  BEFORE: 'BEFORE',
  AFTER: 'AFTER',
  BODY_MAP: 'BODY_MAP',
  PROGRESS: 'PROGRESS',
  CONSENT_DOCUMENTATION: 'CONSENT_DOCUMENTATION',
  OTHER: 'OTHER',
});

export const PHOTO_TYPE_LIST = Object.freeze(Object.values(PHOTO_TYPE));

export const TEMPLATE_TYPE = Object.freeze({
  SOAP: 'SOAP',
  DIAGNOSIS: 'DIAGNOSIS',
  EXAMINATION: 'EXAMINATION',
  /** EMR-003/§8.4 — doctor/clinic favorite quick phrases reused via the same template store. */
  QUICK_PHRASE: 'QUICK_PHRASE',
});

export const TEMPLATE_TYPE_LIST = Object.freeze(Object.values(TEMPLATE_TYPE));

/**
 * Versioning/approval status for a consultation template (Settings → Masters spec: "Consultation
 * templates (versioned, medical-lead approved)"). Mirrors the DRAFT-until-approved convention
 * TreatmentProtocol uses for its own `approvedBy`/`approvedAt` pair.
 */
export const TEMPLATE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
});

export const TEMPLATE_STATUS_LIST = Object.freeze(Object.values(TEMPLATE_STATUS));

export const FOLLOW_UP_UNIT = Object.freeze({
  DAYS: 'DAYS',
  WEEKS: 'WEEKS',
  MONTHS: 'MONTHS',
});

export const FOLLOW_UP_UNIT_LIST = Object.freeze(Object.values(FOLLOW_UP_UNIT));

/**
 * §3.6 — follow-up priority. Reuses the same LOW/NORMAL/HIGH/URGENT vocabulary as
 * TREATMENT_PLAN_PRIORITY (enums/treatmentPlan.js) so a doctor sees one consistent priority
 * scale across the workspace rather than a second, differently-worded one just for follow-ups.
 */
export const FOLLOW_UP_PRIORITY = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
});

export const FOLLOW_UP_PRIORITY_LIST = Object.freeze(Object.values(FOLLOW_UP_PRIORITY));

/** Statuses that allow clinical editing */
export const EDITABLE_CONSULTATION_STATUSES = Object.freeze([
  CONSULTATION_STATUS.DRAFT,
  CONSULTATION_STATUS.IN_PROGRESS,
  CONSULTATION_STATUS.COMPLETED,
]);

/**
 * §3.7 — per-section classification of note content before release. Only PATIENT_FACING content
 * is ever surfaced in the patient app; STAFF_ONLY and INTERNAL_CLINICAL both stay internal.
 * INTERNAL_CLINICAL is the default so a section a doctor never explicitly classifies can never
 * silently become patient-visible.
 */
export const CONTENT_CLASSIFICATION = Object.freeze({
  STAFF_ONLY: 'STAFF_ONLY',
  INTERNAL_CLINICAL: 'INTERNAL_CLINICAL',
  PATIENT_FACING: 'PATIENT_FACING',
});

export const CONTENT_CLASSIFICATION_LIST = Object.freeze(Object.values(CONTENT_CLASSIFICATION));

/**
 * §2 Pre-consult intake — "specialty template auto-selected" is implemented as a fixed intake
 * CATEGORY the nurse confirms/changes on the intake screen (not a `ConsultationTemplate` row:
 * those are per-doctor free-text SOAP/diagnosis/examination authoring templates with no
 * structured field list, so they don't model "which mandatory intake fields apply" — see
 * ConsultationIntake.model.js header for the full decision note). GENERAL is the safe default
 * when nothing on the appointment hints at a specialty.
 */
export const INTAKE_CATEGORY = Object.freeze({
  GENERAL: 'GENERAL',
  NEW_DERMATOLOGY_PATIENT: 'NEW_DERMATOLOGY_PATIENT',
  ACNE: 'ACNE',
  HAIR_LOSS: 'HAIR_LOSS',
  LASER: 'LASER',
  SKIN: 'SKIN',
});

export const INTAKE_CATEGORY_LIST = Object.freeze(Object.values(INTAKE_CATEGORY));

/** Fitzpatrick skin phototype I–VI — standard dermatology intake vocabulary. */
export const SKIN_TYPE = Object.freeze({
  TYPE_I: 'TYPE_I',
  TYPE_II: 'TYPE_II',
  TYPE_III: 'TYPE_III',
  TYPE_IV: 'TYPE_IV',
  TYPE_V: 'TYPE_V',
  TYPE_VI: 'TYPE_VI',
});

export const SKIN_TYPE_LIST = Object.freeze(Object.values(SKIN_TYPE));

export const DURATION_UNIT = Object.freeze({
  DAYS: 'DAYS',
  WEEKS: 'WEEKS',
  MONTHS: 'MONTHS',
  YEARS: 'YEARS',
});

export const DURATION_UNIT_LIST = Object.freeze(Object.values(DURATION_UNIT));

export default {
  CONSULTATION_STATUS,
  PHOTO_TYPE,
  TEMPLATE_TYPE,
  TEMPLATE_STATUS,
  TEMPLATE_STATUS_LIST,
  FOLLOW_UP_UNIT,
  FOLLOW_UP_PRIORITY,
  FOLLOW_UP_PRIORITY_LIST,
  EDITABLE_CONSULTATION_STATUSES,
  CONTENT_CLASSIFICATION,
  INTAKE_CATEGORY,
  INTAKE_CATEGORY_LIST,
  SKIN_TYPE,
  SKIN_TYPE_LIST,
  DURATION_UNIT,
  DURATION_UNIT_LIST,
};
