export const PRESCRIPTION_STATUS_LABELS = Object.freeze({
  DRAFT: 'Draft',
  FINALIZED: 'Finalized',
  CANCELLED: 'Cancelled',
});

export const ROUTE_OPTIONS = Object.freeze([
  { value: 'ORAL', label: 'Oral' },
  { value: 'TOPICAL', label: 'Topical' },
  { value: 'INJECTION', label: 'Injection' },
  { value: 'IV', label: 'IV' },
  { value: 'OTHER', label: 'Other' },
]);

export const FREQUENCY_CHIPS = Object.freeze([
  'Once daily',
  'Twice daily',
  'Thrice daily',
  'As needed (SOS)',
  'At bedtime',
]);

export const DURATION_CHIPS = Object.freeze([
  '5 days',
  '7 days',
  '2 weeks',
  '4 weeks',
  '1 month',
  '3 months',
]);

export const emptyItem = () => ({
  medicineId: '',
  medicineName: '',
  genericName: '',
  strength: '',
  dosage: '',
  frequency: '',
  duration: '',
  route: 'ORAL',
  instructions: '',
  quantity: '',
  morning: false,
  afternoon: false,
  night: false,
  beforeFood: false,
  afterFood: false,
  remarks: '',
});
