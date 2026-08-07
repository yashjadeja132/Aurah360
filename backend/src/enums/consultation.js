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

export const FOLLOW_UP_UNIT = Object.freeze({
  DAYS: 'DAYS',
  WEEKS: 'WEEKS',
  MONTHS: 'MONTHS',
});

export const FOLLOW_UP_UNIT_LIST = Object.freeze(Object.values(FOLLOW_UP_UNIT));

/** Statuses that allow clinical editing */
export const EDITABLE_CONSULTATION_STATUSES = Object.freeze([
  CONSULTATION_STATUS.DRAFT,
  CONSULTATION_STATUS.IN_PROGRESS,
  CONSULTATION_STATUS.COMPLETED,
]);

export default {
  CONSULTATION_STATUS,
  PHOTO_TYPE,
  TEMPLATE_TYPE,
  FOLLOW_UP_UNIT,
  EDITABLE_CONSULTATION_STATUSES,
};
