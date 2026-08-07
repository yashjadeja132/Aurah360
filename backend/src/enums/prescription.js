export const PRESCRIPTION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  FINALIZED: 'FINALIZED',
  CANCELLED: 'CANCELLED',
});

export const PRESCRIPTION_STATUS_LIST = Object.freeze(Object.values(PRESCRIPTION_STATUS));

export const MEDICINE_ROUTE = Object.freeze({
  ORAL: 'ORAL',
  TOPICAL: 'TOPICAL',
  INJECTION: 'INJECTION',
  IV: 'IV',
  OTHER: 'OTHER',
});

export const MEDICINE_ROUTE_LIST = Object.freeze(Object.values(MEDICINE_ROUTE));

export const DOSAGE_FORM = Object.freeze({
  TABLET: 'TABLET',
  CAPSULE: 'CAPSULE',
  SYRUP: 'SYRUP',
  CREAM: 'CREAM',
  GEL: 'GEL',
  OINTMENT: 'OINTMENT',
  LOTION: 'LOTION',
  INJECTION: 'INJECTION',
  DROPS: 'DROPS',
  POWDER: 'POWDER',
  OTHER: 'OTHER',
});

export const DOSAGE_FORM_LIST = Object.freeze(Object.values(DOSAGE_FORM));

export const COMMON_FREQUENCIES = Object.freeze([
  'Once daily',
  'Twice daily',
  'Thrice daily',
  'Four times daily',
  'Every 6 hours',
  'Every 8 hours',
  'Every 12 hours',
  'As needed (SOS)',
  'At bedtime',
  'Weekly',
]);

export default {
  PRESCRIPTION_STATUS,
  MEDICINE_ROUTE,
  DOSAGE_FORM,
  COMMON_FREQUENCIES,
};
