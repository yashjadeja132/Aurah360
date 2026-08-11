export const CONSULTATION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  SIGNED: 'SIGNED',
  LOCKED: 'LOCKED',
});

export const CONSULTATION_STATUS_LIST = Object.freeze(Object.values(CONSULTATION_STATUS));

export const PHOTO_TYPE = Object.freeze({
  BEFORE: 'BEFORE',
  AFTER: 'AFTER',
  BODY_MAP: 'BODY_MAP',
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
};
