/** AI clinical copilot — approved use cases and governance (Module 9). */

export const AI_USE_CASE = Object.freeze({
  SUGGESTED_QUESTIONS: 'SUGGESTED_QUESTIONS',
  RED_FLAG_ASSIST: 'RED_FLAG_ASSIST',
  REPORT_SUMMARY: 'REPORT_SUMMARY',
  TIMELINE_SUMMARY: 'TIMELINE_SUMMARY',
  DRAFT_NOTE: 'DRAFT_NOTE',
  PATIENT_INSTRUCTION_DRAFT: 'PATIENT_INSTRUCTION_DRAFT',
  TREATMENT_CHECKLIST_ASSIST: 'TREATMENT_CHECKLIST_ASSIST',
  ANALYTICS_NARRATIVE: 'ANALYTICS_NARRATIVE',
});

export const AI_USE_CASE_LIST = Object.freeze(Object.values(AI_USE_CASE));

export const AI_DISPOSITION = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EDITED: 'EDITED',
  REJECTED: 'REJECTED',
});

export const AI_DISPOSITION_LIST = Object.freeze(Object.values(AI_DISPOSITION));

export const AI_RUN_STATUS = Object.freeze({
  SUCCESS: 'SUCCESS',
  TIMEOUT: 'TIMEOUT',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  INVALID_OUTPUT: 'INVALID_OUTPUT',
  BLOCKED_PII: 'BLOCKED_PII',
  KILL_SWITCH: 'KILL_SWITCH',
});

export const AI_RUN_STATUS_LIST = Object.freeze(Object.values(AI_RUN_STATUS));

/** Fields that must never reach the AI provider — used by the de-identification filter. */
export const AI_BLOCKED_FIELD_PATTERNS = Object.freeze([
  'firstName',
  'middleName',
  'lastName',
  'mobile',
  'alternateMobile',
  'email',
  'address',
  'city',
  'postalCode',
  'guardianName',
  'guardianPhone',
  'emergencyContactName',
  'emergencyContactPhone',
  'mrn',
  'patientCode',
  'governmentId',
]);

export const AI_EVENTS = Object.freeze({
  RUN_REQUESTED: 'AiRunRequested',
  RUN_COMPLETED: 'AiRunCompleted',
  RUN_DISPOSITIONED: 'AiRunDispositioned',
});

export default {
  AI_USE_CASE,
  AI_DISPOSITION,
  AI_RUN_STATUS,
  AI_BLOCKED_FIELD_PATTERNS,
  AI_EVENTS,
};
