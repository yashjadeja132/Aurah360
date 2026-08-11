export const CONSULTATION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  SIGNED: 'SIGNED',
  LOCKED: 'LOCKED',
});

export const CONSULTATION_STATUS_LABELS = Object.freeze({
  DRAFT: 'Draft',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  SIGNED: 'Signed',
  LOCKED: 'Locked',
});

/**
 * Also doubles as the capture "purpose" list in ClinicalPhotosPanel's pre-camera guard —
 * PROGRESS and CONSENT_DOCUMENTATION were added to the existing photoType enum (see
 * backend/src/enums/consultation.js) rather than introducing a second, parallel "purpose" field.
 */
export const PHOTO_TYPE_OPTIONS = Object.freeze([
  { value: 'BEFORE', label: 'Before treatment' },
  { value: 'AFTER', label: 'After treatment' },
  { value: 'PROGRESS', label: 'Progress' },
  { value: 'CONSENT_DOCUMENTATION', label: 'Consent documentation' },
  { value: 'BODY_MAP', label: 'Body map' },
  { value: 'OTHER', label: 'Other' },
]);

/** Mirrors backend/src/enums/patient.js PHOTO_LATERALITY. */
export const PHOTO_LATERALITY_OPTIONS = Object.freeze([
  { value: 'NOT_APPLICABLE', label: 'N/A' },
  { value: 'LEFT', label: 'Left' },
  { value: 'RIGHT', label: 'Right' },
  { value: 'BILATERAL', label: 'Bilateral' },
  { value: 'CENTRAL', label: 'Central' },
]);

/**
 * Client-side ADVISORY ONLY — a soft warning banner so the nurse sees a hint before hitting the
 * server-side hard block. This is intentionally NOT a reimplementation of the real matcher
 * (backend/src/helpers/bodyRegion.helper.js#findRestrictedBodyRegionTerm, driven by
 * RESTRICTED_BODY_REGION_TERMS), which is normalised/token-based and is — and must stay — the
 * only authority: duplicating that logic here would drift and could be bypassed by editing the
 * client bundle. If this list and the server list ever disagree, the server wins and the upload
 * is refused with `RESTRICTED_BODY_AREA` regardless of what this banner said.
 */
export const RESTRICTED_BODY_REGION_HINTS = Object.freeze([
  'genital',
  'perianal',
  'areola',
  'breast',
  'buttock',
]);

export const FOLLOW_UP_UNITS = Object.freeze([
  { value: 'DAYS', label: 'Days' },
  { value: 'WEEKS', label: 'Weeks' },
  { value: 'MONTHS', label: 'Months' },
]);

/** §3.6 — same LOW/NORMAL/HIGH/URGENT vocabulary as treatment plan priority (backend enum). */
export const FOLLOW_UP_PRIORITIES = Object.freeze([
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]);

export const FOLLOW_UP_STATUS_LABELS = Object.freeze({
  PENDING: 'Pending',
  DONE: 'Done',
  RESCHEDULED: 'Rescheduled',
});

export const LAB_ORDER_STATUS = Object.freeze({
  ORDERED: 'ORDERED',
  RESULT_RECEIVED: 'RESULT_RECEIVED',
  REVIEWED: 'REVIEWED',
  CANCELLED: 'CANCELLED',
});

export const LAB_ORDER_STATUS_LABELS = Object.freeze({
  ORDERED: 'Ordered',
  RESULT_RECEIVED: 'Result received',
  REVIEWED: 'Doctor reviewed',
  CANCELLED: 'Cancelled',
});

/** Patient-context sections — first group of the workspace's single tab strip. */
export const CONTEXT_SECTIONS = Object.freeze([
  { id: 'summary', label: 'Summary' },
  { id: 'timeline', label: 'Timeline' },
]);

/**
 * Clinical-record sections of the workspace. `ai` is deliberately NOT here: the copilot owns its
 * own half of the cockpit, so the doctor never has to leave the note to read it.
 */
/**
 * `diagnosis` is deliberately NOT its own tab: §3.1 treats diagnosis as part of the SOAP note's
 * Assessment section, so its picker/favorites UI is mounted inline inside the `soap` tab
 * (see SoapEditor.jsx) instead.
 */
export const RECORD_SECTIONS = Object.freeze([
  { id: 'intake', label: 'Intake' },
  { id: 'soap', label: 'SOAP' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'exam', label: 'Examination' },
  { id: 'rx', label: 'Rx draft' },
  { id: 'photos', label: 'Photos' },
  { id: 'labs', label: 'Lab orders' },
  { id: 'treatment', label: 'Treatment' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'release', label: 'Release to patient' },
]);

/** §3.7 — per-section classification before release; only PATIENT_FACING ever reaches the patient app. */
export const CONTENT_CLASSIFICATION_OPTIONS = Object.freeze([
  { value: 'STAFF_ONLY', label: 'Staff-only' },
  { value: 'INTERNAL_CLINICAL', label: 'Internal clinical' },
  { value: 'PATIENT_FACING', label: 'Patient-facing' },
]);

/**
 * §2 Pre-consult intake — "specialty template auto-selected" is this fixed category list, not
 * `ConsultationTemplate` (see backend/src/models/ConsultationIntake.model.js header for the full
 * decision note: those are free-text SOAP/exam authoring templates with no structured field list
 * to key a specialty off of). Every category shares the same mandatory field set today — this is
 * a label/default only, not yet a per-category form variant.
 */
export const INTAKE_CATEGORY_OPTIONS = Object.freeze([
  { value: 'GENERAL', label: 'General visit' },
  { value: 'NEW_DERMATOLOGY_PATIENT', label: 'New dermatology patient' },
  { value: 'ACNE', label: 'Acne' },
  { value: 'HAIR_LOSS', label: 'Hair loss' },
  { value: 'LASER', label: 'Laser' },
  { value: 'SKIN', label: 'Skin' },
]);

export const DURATION_UNIT_OPTIONS = Object.freeze([
  { value: 'DAYS', label: 'Days' },
  { value: 'WEEKS', label: 'Weeks' },
  { value: 'MONTHS', label: 'Months' },
  { value: 'YEARS', label: 'Years' },
]);

/** Fitzpatrick I–VI. */
export const SKIN_TYPE_OPTIONS = Object.freeze([
  { value: 'TYPE_I', label: 'Type I' },
  { value: 'TYPE_II', label: 'Type II' },
  { value: 'TYPE_III', label: 'Type III' },
  { value: 'TYPE_IV', label: 'Type IV' },
  { value: 'TYPE_V', label: 'Type V' },
  { value: 'TYPE_VI', label: 'Type VI' },
]);

/** @deprecated Retained for callers outside the workspace; use RECORD_SECTIONS. */
export const WORKSPACE_TABS = Object.freeze([
  { id: 'soap', label: 'SOAP' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'exam', label: 'Examination' },
  { id: 'diagnosis', label: 'Diagnosis' },
  { id: 'photos', label: 'Photos' },
  { id: 'labs', label: 'Lab orders' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'ai', label: 'AI assist' },
]);
