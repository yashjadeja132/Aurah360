export const PATIENT_PORTAL_EVENTS = Object.freeze({
  PATIENT_LOGGED_IN: 'PatientLoggedIn',
  FEEDBACK_SUBMITTED: 'FeedbackSubmitted',
  DOCUMENT_DOWNLOADED: 'DocumentDownloaded',
});

/** Hours before appointment start when cancel/reschedule is still allowed */
export const APPOINTMENT_CHANGE_MIN_HOURS = 24;

export default {
  PATIENT_PORTAL_EVENTS,
  APPOINTMENT_CHANGE_MIN_HOURS,
};
