export const TREATMENT_PLAN_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  RECOMMENDED: 'RECOMMENDED',
  APPROVED: 'APPROVED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  COMPLETED: 'COMPLETED',
});

export const TREATMENT_PLAN_STATUS_LIST = Object.freeze(Object.values(TREATMENT_PLAN_STATUS));

/** Statuses that still allow plan content edits. */
export const EDITABLE_TREATMENT_PLAN_STATUSES = Object.freeze([
  TREATMENT_PLAN_STATUS.DRAFT,
  TREATMENT_PLAN_STATUS.RECOMMENDED,
  TREATMENT_PLAN_STATUS.APPROVED,
]);

export const TREATMENT_PLAN_PRIORITY = Object.freeze({
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
});

export const TREATMENT_PLAN_PRIORITY_LIST = Object.freeze(Object.values(TREATMENT_PLAN_PRIORITY));

export const CONSENT_TYPE = Object.freeze({
  LASER: 'LASER',
  PHOTOGRAPHY: 'PHOTOGRAPHY',
  TREATMENT: 'TREATMENT',
  PROCEDURE: 'PROCEDURE',
});

export const CONSENT_TYPE_LIST = Object.freeze(Object.values(CONSENT_TYPE));

export const CONSENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
});

export const CONSENT_STATUS_LIST = Object.freeze(Object.values(CONSENT_STATUS));

export const TREATMENT_CATEGORIES = Object.freeze([
  'Hair',
  'Skin',
  'Laser',
  'Injectables',
  'Body',
  'Facial',
  'Peel',
  'Other',
]);

export default {
  TREATMENT_PLAN_STATUS,
  TREATMENT_PLAN_PRIORITY,
  CONSENT_TYPE,
  CONSENT_STATUS,
  TREATMENT_CATEGORIES,
};
