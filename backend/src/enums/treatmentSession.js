export const TREATMENT_SESSION_STATUS = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  CHECKED_IN: 'CHECKED_IN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  SKIPPED: 'SKIPPED',
});

export const TREATMENT_SESSION_STATUS_LIST = Object.freeze(
  Object.values(TREATMENT_SESSION_STATUS)
);

/** Statuses that count toward session usage / remaining limit. */
export const ACTIVE_OR_DONE_SESSION_STATUSES = Object.freeze([
  TREATMENT_SESSION_STATUS.SCHEDULED,
  TREATMENT_SESSION_STATUS.CHECKED_IN,
  TREATMENT_SESSION_STATUS.IN_PROGRESS,
  TREATMENT_SESSION_STATUS.COMPLETED,
]);

/** Configurable payment gate — Paid or Partial allowed by default. */
export const SESSION_ALLOWED_PAYMENT_STATUSES = Object.freeze([
  'PAID',
  'PARTIALLY_PAID',
]);

export const TREATMENT_SESSION_EVENTS = Object.freeze({
  STARTED: 'TreatmentSessionStarted',
  COMPLETED: 'TreatmentSessionCompleted',
  PLAN_COMPLETED: 'TreatmentPlanCompleted',
  ADVERSE_EVENT_REPORTED: 'AdverseEventReported',
  ADVERSE_EVENT_CLOSED: 'AdverseEventClosed',
});

/** Patch test validity/result (TRT-006) */
export const PATCH_TEST_RESULT = Object.freeze({
  PENDING: 'PENDING',
  NEGATIVE: 'NEGATIVE',
  POSITIVE: 'POSITIVE',
  INCONCLUSIVE: 'INCONCLUSIVE',
});

export const PATCH_TEST_RESULT_LIST = Object.freeze(Object.values(PATCH_TEST_RESULT));

/** Adverse event severity/status (§10.3, §16.10) */
export const ADVERSE_EVENT_SEVERITY = Object.freeze({
  MILD: 'MILD',
  MODERATE: 'MODERATE',
  SEVERE: 'SEVERE',
  LIFE_THREATENING: 'LIFE_THREATENING',
});

export const ADVERSE_EVENT_SEVERITY_LIST = Object.freeze(Object.values(ADVERSE_EVENT_SEVERITY));

export const ADVERSE_EVENT_STATUS = Object.freeze({
  OPEN: 'OPEN',
  ESCALATED: 'ESCALATED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
});

export const ADVERSE_EVENT_STATUS_LIST = Object.freeze(Object.values(ADVERSE_EVENT_STATUS));

/** Hard-stop preflight checks before a treatment session can start (§10.3, §16.10) */
export const HARD_STOP_TYPE = Object.freeze({
  /** A consent record exists for the plan but is not signed. */
  CONSENT_MISSING: 'CONSENT_MISSING',
  /** No consent record exists for the plan at all, and the protocol requires one. */
  CONSENT_ABSENT: 'CONSENT_ABSENT',
  PATCH_TEST_MISSING: 'PATCH_TEST_MISSING',
  PATCH_TEST_POSITIVE: 'PATCH_TEST_POSITIVE',
  DEVICE_UNAVAILABLE: 'DEVICE_UNAVAILABLE',
  ROOM_UNAVAILABLE: 'ROOM_UNAVAILABLE',
  OPERATOR_SKILL_MISSING: 'OPERATOR_SKILL_MISSING',
  OPERATOR_SKILL_EXPIRED: 'OPERATOR_SKILL_EXPIRED',
  CONTRAINDICATION: 'CONTRAINDICATION',
  /** The protocol declares contraindication questions but no screening answers are recorded. */
  CONTRAINDICATION_SCREENING_MISSING: 'CONTRAINDICATION_SCREENING_MISSING',
  /** Patient age falls outside the protocol's declared ageRestrictionMin/Max window. */
  AGE_RESTRICTION: 'AGE_RESTRICTION',
  /** Patient date of birth is not recorded, so a declared age restriction cannot be evaluated. */
  AGE_UNKNOWN: 'AGE_UNKNOWN',
  PACKAGE_BALANCE_EXHAUSTED: 'PACKAGE_BALANCE_EXHAUSTED',
  /** The plan's package has passed its validityDays window. */
  PACKAGE_EXPIRED: 'PACKAGE_EXPIRED',
});

export const HARD_STOP_TYPE_LIST = Object.freeze(Object.values(HARD_STOP_TYPE));

/**
 * TRT-006 — stable gate keys for the read-only start pre-flight (GET /treatment-sessions/:id/preflight).
 * These mirror, one-for-one and in evaluation order, the checks the real start() performs; the
 * pre-flight and start() share a single evaluator so the two can never drift.
 */
export const PREFLIGHT_GATE = Object.freeze({
  SESSION_STATUS: 'SESSION_STATUS',
  PLAN_ACCEPTED: 'PLAN_ACCEPTED',
  INVOICE_LINKED: 'INVOICE_LINKED',
  INVOICE_PAYMENT: 'INVOICE_PAYMENT',
  CONSENT: 'CONSENT',
  PATCH_TEST: 'PATCH_TEST',
  ROOM: 'ROOM',
  DEVICE: 'DEVICE',
  OPERATOR_CREDENTIAL: 'OPERATOR_CREDENTIAL',
  CONTRAINDICATION: 'CONTRAINDICATION',
  AGE_RESTRICTION: 'AGE_RESTRICTION',
  PACKAGE_VALIDITY: 'PACKAGE_VALIDITY',
  PACKAGE_BALANCE: 'PACKAGE_BALANCE',
});

export const PREFLIGHT_GATE_LIST = Object.freeze(Object.values(PREFLIGHT_GATE));

export default {
  TREATMENT_SESSION_STATUS,
  SESSION_ALLOWED_PAYMENT_STATUSES,
  TREATMENT_SESSION_EVENTS,
  PATCH_TEST_RESULT,
  ADVERSE_EVENT_SEVERITY,
  ADVERSE_EVENT_STATUS,
  HARD_STOP_TYPE,
  PREFLIGHT_GATE,
};
