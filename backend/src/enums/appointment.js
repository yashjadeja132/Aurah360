export const APPOINTMENT_STATUS = Object.freeze({
  REQUESTED: 'REQUESTED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  WAITING: 'WAITING',
  IN_CONSULTATION: 'IN_CONSULTATION',
  AWAITING_TREATMENT: 'AWAITING_TREATMENT',
  TREATMENT: 'TREATMENT',
  AWAITING_BILLING: 'AWAITING_BILLING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
  RESCHEDULED: 'RESCHEDULED',
});

export const APPOINTMENT_STATUS_LIST = Object.freeze(Object.values(APPOINTMENT_STATUS));

/** Statuses that occupy a doctor/patient slot */
export const ACTIVE_APPOINTMENT_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.REQUESTED,
  APPOINTMENT_STATUS.PENDING_APPROVAL,
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.CHECKED_IN,
  APPOINTMENT_STATUS.WAITING,
  APPOINTMENT_STATUS.IN_CONSULTATION,
  APPOINTMENT_STATUS.AWAITING_TREATMENT,
  APPOINTMENT_STATUS.TREATMENT,
  APPOINTMENT_STATUS.AWAITING_BILLING,
]);

/**
 * Statuses that hold an EXCLUSIVE claim on a doctor-minute — the set the database-level unique
 * index is filtered to (§2.4 "zero system-permitted double-booking", NFR-004).
 *
 * Deliberately NARROWER than ACTIVE_APPOINTMENT_STATUSES, because a database constraint that
 * blocks more than the service layer blocks is an outage, not a fix:
 *  - REQUESTED / PENDING_APPROVAL are excluded: APT-003 lets a patient PROPOSE a slot that is
 *    already taken, precisely so the approver can reject it or counter-offer. A unique index
 *    covering proposals would make that workflow impossible to even enter.
 *  - CANCELLED / NO_SHOW / RESCHEDULED are excluded so a freed minute is rebookable.
 *  - COMPLETED is excluded because AppointmentConflictService already treats a completed visit as
 *    no longer occupying the slot; the index must not be stricter than the check it backs.
 */
export const SLOT_COMMITTED_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.CHECKED_IN,
  APPOINTMENT_STATUS.WAITING,
  APPOINTMENT_STATUS.IN_CONSULTATION,
  APPOINTMENT_STATUS.AWAITING_TREATMENT,
  APPOINTMENT_STATUS.TREATMENT,
  APPOINTMENT_STATUS.AWAITING_BILLING,
]);

/** Statuses requiring approver action before a slot is committed (APT-003) */
export const AWAITING_APPROVAL_STATUSES = Object.freeze([
  APPOINTMENT_STATUS.REQUESTED,
  APPOINTMENT_STATUS.PENDING_APPROVAL,
]);

export const APPROVAL_DECISION = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  ALTERNATIVE_PROPOSED: 'ALTERNATIVE_PROPOSED',
  REJECTED: 'REJECTED',
});

export const APPROVAL_DECISION_LIST = Object.freeze(Object.values(APPROVAL_DECISION));

export const WAITLIST_STATUS = Object.freeze({
  WAITING: 'WAITING',
  OFFERED: 'OFFERED',
  BOOKED: 'BOOKED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
});

export const WAITLIST_STATUS_LIST = Object.freeze(Object.values(WAITLIST_STATUS));

export const APPOINTMENT_TYPE = Object.freeze({
  CONSULTATION: 'CONSULTATION',
  FOLLOW_UP: 'FOLLOW_UP',
  PROCEDURE: 'PROCEDURE',
  TREATMENT: 'TREATMENT',
  OTHER: 'OTHER',
});

export const APPOINTMENT_TYPE_LIST = Object.freeze(Object.values(APPOINTMENT_TYPE));

export const APPOINTMENT_SOURCE = Object.freeze({
  WALK_IN: 'WALK_IN',
  PHONE: 'PHONE',
  ONLINE: 'ONLINE',
  APP: 'APP',
  WHATSAPP: 'WHATSAPP',
  WEBSITE: 'WEBSITE',
  REFERRAL: 'REFERRAL',
  OTHER: 'OTHER',
});

export const APPOINTMENT_SOURCE_LIST = Object.freeze(Object.values(APPOINTMENT_SOURCE));

export const APPOINTMENT_PRIORITY = Object.freeze({
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
});

export const APPOINTMENT_PRIORITY_LIST = Object.freeze(Object.values(APPOINTMENT_PRIORITY));

/** A13 — controlled cancellation reason list; a bare cancel (no reason) is not allowed. */
export const CANCELLATION_REASON = Object.freeze({
  PATIENT_REQUEST: 'PATIENT_REQUEST',
  PATIENT_NO_SHOW: 'PATIENT_NO_SHOW',
  DOCTOR_UNAVAILABLE: 'DOCTOR_UNAVAILABLE',
  RESCHEDULED: 'RESCHEDULED',
  DUPLICATE_BOOKING: 'DUPLICATE_BOOKING',
  CLINIC_CLOSURE: 'CLINIC_CLOSURE',
  MEDICAL_REASON: 'MEDICAL_REASON',
  OTHER: 'OTHER',
});

export const CANCELLATION_REASON_LIST = Object.freeze(Object.values(CANCELLATION_REASON));

export default {
  APPOINTMENT_STATUS,
  APPOINTMENT_TYPE,
  APPOINTMENT_SOURCE,
  APPOINTMENT_PRIORITY,
  CANCELLATION_REASON,
  ACTIVE_APPOINTMENT_STATUSES,
  SLOT_COMMITTED_STATUSES,
  AWAITING_APPROVAL_STATUSES,
  APPROVAL_DECISION,
  WAITLIST_STATUS,
};
