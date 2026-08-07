export const LEAVE_TYPE = Object.freeze({
  FULL_DAY: 'FULL_DAY',
  HALF_DAY: 'HALF_DAY',
  CUSTOM: 'CUSTOM',
});

export const LEAVE_TYPE_LIST = Object.freeze(Object.values(LEAVE_TYPE));

export const LEAVE_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
});

export const LEAVE_STATUS_LIST = Object.freeze(Object.values(LEAVE_STATUS));

export default { LEAVE_TYPE, LEAVE_STATUS };
