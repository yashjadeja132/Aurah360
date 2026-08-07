export const TREATMENT_PLAN_STATUS_LABELS = Object.freeze({
  DRAFT: 'Draft',
  RECOMMENDED: 'Recommended',
  APPROVED: 'Approved',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
});

export const EDITABLE_STATUSES = Object.freeze(['DRAFT', 'RECOMMENDED', 'APPROVED']);

export const PRIORITY_OPTIONS = Object.freeze([
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
]);

export const CATEGORY_OPTIONS = Object.freeze([
  'Hair',
  'Skin',
  'Laser',
  'Injectables',
  'Body',
  'Facial',
  'Peel',
  'Other',
]);

export const CONSENT_TYPE_LABELS = Object.freeze({
  LASER: 'Laser',
  PHOTOGRAPHY: 'Photography',
  TREATMENT: 'Treatment',
  PROCEDURE: 'Procedure',
});

export const WIZARD_STEPS = Object.freeze([
  { id: 1, key: 'diagnosis', label: 'Diagnosis' },
  { id: 2, key: 'protocol', label: 'Protocol' },
  { id: 3, key: 'sessions', label: 'Sessions' },
  { id: 4, key: 'package', label: 'Package' },
  { id: 5, key: 'consent', label: 'Consent' },
  { id: 6, key: 'review', label: 'Review' },
]);

export const emptyItem = () => ({
  serviceId: '',
  procedureName: '',
  sessionCount: 1,
  sessionDuration: 30,
  frequency: '',
  deviceRequired: '',
  roomRequired: '',
  technicianRequired: true,
  consumables: '',
  preInstructions: '',
  postInstructions: '',
  notes: '',
});

export default {
  TREATMENT_PLAN_STATUS_LABELS,
  WIZARD_STEPS,
};
