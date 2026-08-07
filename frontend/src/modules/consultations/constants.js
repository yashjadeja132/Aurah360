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

export const WORKSPACE_TABS = Object.freeze([
  { id: 'soap', label: 'SOAP' },
  { id: 'vitals', label: 'Vitals' },
  { id: 'exam', label: 'Examination' },
  { id: 'diagnosis', label: 'Diagnosis' },
  { id: 'photos', label: 'Photos' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'ai', label: 'AI assist' },
]);
