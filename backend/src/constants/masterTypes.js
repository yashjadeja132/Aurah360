/**
 * Master data types — single collection, typed by `type`.
 * Dropdowns across ClinicOS must load from these records (no hardcoding).
 */
export const MASTER_TYPES = Object.freeze({
  DEPARTMENT: 'DEPARTMENT',
  DESIGNATION: 'DESIGNATION',
  SERVICE_CATEGORY: 'SERVICE_CATEGORY',
  SERVICE: 'SERVICE',
  APPOINTMENT_STATUS: 'APPOINTMENT_STATUS',
  PAYMENT_METHOD: 'PAYMENT_METHOD',
  LEAD_SOURCE: 'LEAD_SOURCE',
  PATIENT_TAG: 'PATIENT_TAG',
  DOCUMENT_CATEGORY: 'DOCUMENT_CATEGORY',
  FOLLOW_UP_REASON: 'FOLLOW_UP_REASON',
  REFERRAL_SOURCE: 'REFERRAL_SOURCE',
  HANDOFF_CATEGORY: 'HANDOFF_CATEGORY',
});

export const MASTER_TYPE_LIST = Object.freeze(Object.values(MASTER_TYPES));

export const MASTER_TYPE_LABELS = Object.freeze({
  [MASTER_TYPES.DEPARTMENT]: 'Departments',
  [MASTER_TYPES.DESIGNATION]: 'Designations',
  [MASTER_TYPES.SERVICE_CATEGORY]: 'Service Categories',
  [MASTER_TYPES.SERVICE]: 'Services',
  [MASTER_TYPES.APPOINTMENT_STATUS]: 'Appointment Statuses',
  [MASTER_TYPES.PAYMENT_METHOD]: 'Payment Methods',
  [MASTER_TYPES.LEAD_SOURCE]: 'Lead Sources',
  [MASTER_TYPES.PATIENT_TAG]: 'Patient Tags',
  [MASTER_TYPES.DOCUMENT_CATEGORY]: 'Document & Report Categories',
  [MASTER_TYPES.FOLLOW_UP_REASON]: 'Follow-up Reasons',
  [MASTER_TYPES.REFERRAL_SOURCE]: 'Referral Sources',
  [MASTER_TYPES.HANDOFF_CATEGORY]: 'Handoff Categories',
});

export const MASTER_SLUG_TO_TYPE = Object.freeze({
  departments: MASTER_TYPES.DEPARTMENT,
  designations: MASTER_TYPES.DESIGNATION,
  'service-categories': MASTER_TYPES.SERVICE_CATEGORY,
  services: MASTER_TYPES.SERVICE,
  'appointment-statuses': MASTER_TYPES.APPOINTMENT_STATUS,
  'payment-methods': MASTER_TYPES.PAYMENT_METHOD,
  'lead-sources': MASTER_TYPES.LEAD_SOURCE,
  'patient-tags': MASTER_TYPES.PATIENT_TAG,
  'document-categories': MASTER_TYPES.DOCUMENT_CATEGORY,
  'follow-up-reasons': MASTER_TYPES.FOLLOW_UP_REASON,
  'referral-sources': MASTER_TYPES.REFERRAL_SOURCE,
  'handoff-categories': MASTER_TYPES.HANDOFF_CATEGORY,
});

export const MASTER_TYPE_TO_SLUG = Object.freeze(
  Object.fromEntries(Object.entries(MASTER_SLUG_TO_TYPE).map(([slug, type]) => [type, slug]))
);

export default MASTER_TYPES;
