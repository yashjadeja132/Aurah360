export const QUEUE_STATUS = Object.freeze({
  WAITING: 'WAITING',
  CALLED: 'CALLED',
  IN_CONSULTATION: 'IN_CONSULTATION',
  TREATMENT: 'TREATMENT',
  COMPLETED: 'COMPLETED',
  SKIPPED: 'SKIPPED',
  CANCELLED: 'CANCELLED',
});

export const QUEUE_STATUS_LABELS = Object.freeze({
  WAITING: 'Waiting',
  CALLED: 'Called',
  IN_CONSULTATION: 'In Consultation',
  TREATMENT: 'Treatment',
  COMPLETED: 'Completed',
  SKIPPED: 'Skipped',
  CANCELLED: 'Cancelled',
});

export const QUEUE_PRIORITY = Object.freeze({
  EMERGENCY: 'EMERGENCY',
  VIP: 'VIP',
  PREGNANT: 'PREGNANT',
  SENIOR_CITIZEN: 'SENIOR_CITIZEN',
  CHILDREN: 'CHILDREN',
  NORMAL: 'NORMAL',
});

export const QUEUE_PRIORITY_LABELS = Object.freeze({
  EMERGENCY: 'Emergency',
  VIP: 'VIP',
  PREGNANT: 'Pregnant',
  SENIOR_CITIZEN: 'Senior Citizen',
  CHILDREN: 'Children',
  NORMAL: 'Normal',
});

export const QUEUE_PRIORITY_OPTIONS = Object.freeze(
  Object.entries(QUEUE_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))
);

export const SOCKET_EVENTS = Object.freeze({
  PATIENT_CHECKED_IN: 'PatientCheckedIn',
  QUEUE_UPDATED: 'QueueUpdated',
  PATIENT_CALLED: 'PatientCalled',
  QUEUE_COMPLETED: 'QueueCompleted',
  DOCTOR_STATUS_UPDATED: 'DoctorStatusUpdated',
});

export const STATUS_BADGE_VARIANT = Object.freeze({
  WAITING: 'warning',
  CALLED: 'default',
  IN_CONSULTATION: 'success',
  TREATMENT: 'secondary',
  COMPLETED: 'outline',
  SKIPPED: 'destructive',
  CANCELLED: 'destructive',
});
