export const APPOINTMENT_STATUS_LABELS = Object.freeze({
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CHECKED_IN: 'Checked In',
  IN_CONSULTATION: 'In Consultation',
  TREATMENT: 'Treatment',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No Show',
  RESCHEDULED: 'Rescheduled',
});

export const APPOINTMENT_STATUS_VARIANT = Object.freeze({
  SCHEDULED: 'secondary',
  CONFIRMED: 'default',
  CHECKED_IN: 'warning',
  IN_CONSULTATION: 'warning',
  TREATMENT: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
  NO_SHOW: 'destructive',
  RESCHEDULED: 'secondary',
});

export const STATUS_OPTIONS = Object.keys(APPOINTMENT_STATUS_LABELS);
