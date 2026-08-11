export const SESSION_STATUS_LABELS = Object.freeze({
  SCHEDULED: 'Scheduled',
  CHECKED_IN: 'Checked in',
  IN_PROGRESS: 'In progress',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  SKIPPED: 'Skipped',
});

/** TRT-006 — labels for the start pre-flight gate keys returned by the backend. */
export const PREFLIGHT_GATE_LABELS = Object.freeze({
  SESSION_STATUS: 'Session is startable',
  PLAN_ACCEPTED: 'Treatment plan accepted',
  INVOICE_LINKED: 'Invoice linked to this session',
  INVOICE_PAYMENT: 'Invoice paid or partially paid',
  CONSENT: 'Treatment consent signed',
  PATCH_TEST: 'Patch test valid',
  ROOM: 'Assigned room in service',
  DEVICE: 'Assigned device in service',
  OPERATOR_CREDENTIAL: 'Operator credentialed for protocol',
  PACKAGE_BALANCE: 'Package / plan sessions remaining',
});

export default { SESSION_STATUS_LABELS, PREFLIGHT_GATE_LABELS };
