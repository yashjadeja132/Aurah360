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

export const PHOTO_TYPE_OPTIONS = Object.freeze([
  { value: 'BEFORE', label: 'Before' },
  { value: 'AFTER', label: 'After' },
  { value: 'BODY_MAP', label: 'Body map' },
  { value: 'OTHER', label: 'Other' },
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
