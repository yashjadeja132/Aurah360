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
  { id: 'timeline', label: 'History' },
]);

/**
 * Clinical-record sections of the workspace. `ai` is deliberately NOT here: the copilot owns its
 * own half of the cockpit, so the doctor never has to leave the note to read it.
 *
 * Simplified flow (docs/SIMPLIFIED_FLOW.md): Vitals and Examination tabs are dropped —
 * the doctor's file is note → diagnosis → medicines/reports → photos → next visit.
 * The panels still exist; re-add an entry here to bring one back.
 */
export const RECORD_SECTIONS = Object.freeze([
  { id: 'soap', label: "Today's note" },
  { id: 'diagnosis', label: 'Diagnosis' },
  { id: 'rx', label: 'Medicines' },
  { id: 'labs', label: 'Reports' },
  { id: 'photos', label: 'Photos' },
  { id: 'followup', label: 'Next visit' },
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
