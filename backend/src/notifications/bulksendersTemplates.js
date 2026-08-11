/**
 * BulkSenders.in DLT template registry — every SMS template approved for header AURAHX
 * (PE ID 1701178590770734572), imported verbatim from the operator's template dump report
 * of 2026-08-11. DLT rejects any message whose text does not match a registered template,
 * so each `build()` reproduces the registered content exactly and only fills the
 * {#alp#}/{#num#}/{#urg#} slots.
 *
 * Slot rules: {#alp#}/{#num#} accept at most 30 characters, so every variable is trimmed;
 * {#num#} slots are digits-only and are stripped accordingly.
 */

/** Trim an alphanumeric slot value to the 30-char DLT limit. */
const alp = (value, fallback) => {
  const s = String(value ?? '').trim() || fallback;
  return s.length > 30 ? s.slice(0, 30) : s;
};

/** Digits (and decimal point) only, for {#num#} slots. */
const num = (value, fallback = '0') => {
  const s = String(value ?? '').replace(/[^\d.]/g, '');
  return (s || fallback).slice(0, 30);
};

/** URL slot ({#urg#}). */
const url = (value) => String(value ?? '').trim() || 'https://aurah360.com/';

export const BULKSENDERS_TEMPLATES = Object.freeze({
  APPOINTMENT_CONFIRMED: {
    id: '1777178593476251940',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your appointment with Dr. ${alp(v.doctorName, 'Aurah 360')} is confirmed for ${alp(v.date, 'your slot')} at ${alp(v.time, 'the clinic')}. - Aurah 360`,
  },
  OTP: {
    id: '1777178601448061730',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Customer')}, your OTP is ${num(v.otpCode)}. Valid for ${alp(v.validityMinutes, '10')} minutes. Do not share it. Website - https://aurah360.com/ - Aurah 360`,
  },
  REGISTRATION_SUCCESS: {
    id: '1777178601987158707',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your Aurah 360 registration has been completed successfully. Thank you. - Aurah 360`,
  },
  APPOINTMENT_REMINDER: {
    id: '1777178602002095431',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, reminder of your appointment on ${alp(v.date, 'your date')} at ${alp(v.time, 'the clinic')}. Please arrive 10 minutes early. - Aurah 360`,
  },
  TODAYS_APPOINTMENT: {
    id: '1777178602009996434',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, this is a reminder for today's appointment at ${alp(v.time, 'the clinic')}. See you soon. - Aurah 360`,
  },
  THIRTY_MIN_REMINDER: {
    id: '1777178602019096734',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your appointment starts in 30 minutes. Please visit the clinic on time. - Aurah 360`,
  },
  CHECK_IN_SUCCESS: {
    id: '1777178602090014553',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your check-in is complete. Token No: ${num(v.tokenNumber)}. Please wait for your turn. - Aurah 360`,
  },
  TOKEN_CALLED: {
    id: '1777178602093310769',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, Token ${num(v.tokenNumber)} has been called. Please proceed to the consultation room. - Aurah 360`,
  },
  APPOINTMENT_CANCELLED: {
    id: '1777178602100043808',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your appointment scheduled on ${alp(v.date, 'your date')} has been cancelled. Book again: ${url(v.link)} - Aurah 360`,
  },
  WELCOME: {
    id: '1777178642601253706',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, to Aurah 360. Thank you for choosing us. Book appointments anytime. - Aurah 360`,
  },
  PACKAGE_EXPIRY: {
    id: '1777178642675146364',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your treatment package expires on ${alp(v.date, 'soon')}. Please complete your sessions. - Aurah 360`,
  },
  NEXT_SESSION: {
    id: '1777178642678295324',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your next treatment session is on ${alp(v.date, 'your date')}. We look forward to seeing you. - Aurah 360`,
  },
  TREATMENT_REMINDER: {
    id: '1777178642684094983',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your ${alp(v.treatment, 'treatment')} session is scheduled on ${alp(v.date, 'your date')} at ${alp(v.time, 'the clinic')}. - Aurah 360`,
  },
  MISSED_FOLLOW_UP: {
    id: '1777178642687033130',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, you missed your follow-up visit. Schedule a new appointment: ${url(v.link)} - Aurah 360`,
  },
  FOLLOW_UP_REMINDER: {
    id: '1777178642695298929',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your follow-up is due on ${alp(v.date, 'your date')}. Book now: ${url(v.link)} - Aurah 360`,
  },
  PENDING_APPROVAL: {
    id: '1777178642699139927',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your appointment request is under review. We'll notify you shortly. - Aurah 360`,
  },
  RESCHEDULE_REJECTED: {
    id: '1777178642702325765',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your requested slot is unavailable. Please choose another slot: ${url(v.link)} - Aurah 360`,
  },
  RESCHEDULE_APPROVED: {
    id: '1777178642707061389',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your requested appointment has been approved for ${alp(v.date, 'your date')} at ${alp(v.time, 'the clinic')}. - Aurah 360`,
  },
  APPOINTMENT_RESCHEDULED: {
    id: '1777178642710180808',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your appointment has been rescheduled to ${alp(v.date, 'your date')} at ${alp(v.time, 'the clinic')}. - Aurah 360`,
  },
  INVOICE_GENERATED: {
    id: '1777178642718301057',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, Invoice No. ${alp(v.invoiceNumber, 'your invoice')} for Rs.${num(v.amount)} has been generated. - Aurah 360`,
  },
  PAYMENT_RECEIVED: {
    id: '1777178642722391846',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, payment of Rs.${num(v.amount)} has been received successfully. Thank you. - Aurah 360`,
  },
  PAYMENT_DUE: {
    id: '1777178642726081354',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your outstanding balance is Rs.${num(v.amount)}. Kindly complete payment. - Aurah 360`,
  },
  CONSENT_RECORDED: {
    id: '1777178642762029052',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your consent has been recorded successfully. Thank you. - Aurah 360`,
  },
  ACCOUNT_LOGIN_OTP: {
    id: '1777178642799110727',
    build: (v) =>
      `Login OTP: ${num(v.otpCode)}. Valid for ${alp(v.validityMinutes, '10')} minutes. Do not share it. - Aurah 360`,
  },
  PASSWORD_RESET: {
    id: '1777178642817515354',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, reset your account using this secure link: ${url(v.link)} - Aurah 360`,
  },
  APPOINTMENT_APPROVED: {
    id: '1777178642821438314',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your appointment request has been approved. See you on ${alp(v.date, 'your date')}. - Aurah 360`,
  },
  APPOINTMENT_DECLINED: {
    id: '1777178642829289185',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, we couldn't confirm your requested appointment. Please choose another slot. - Aurah 360`,
  },
  VISIT_COMPLETED: {
    id: '1777178642833226757',
    // Registered without the "- Aurah 360" suffix — do not add one.
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, thank you for visiting Aurah 360. We wish you a speedy recovery.`,
  },
  UPLOAD_REPORT_REMINDER: {
    id: '1777178642838819557',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, please upload your report before your appointment using this link: ${url(v.link)} - Aurah 360`,
  },
  BOOKING_SUCCESS: {
    id: '1777178642865399507',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your booking request has been received successfully. - Aurah 360`,
  },
  GENERAL_NOTIFICATION: {
    id: '1777178642870096778',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, you have a new update in your Aurah 360 account. Please log in to view it. - Aurah 360`,
  },
  PRESCRIPTION_READY: {
    id: '1777178642873603395',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your prescription is available. View here: ${url(v.link)} - Aurah 360`,
  },
  REPORT_READY: {
    id: '1777178642875783411',
    build: (v) =>
      `Dear ${alp(v.patientName, 'Patient')}, your report is ready. View securely here: ${url(v.link)} - Aurah 360`,
  },
});

/**
 * Domain event → DLT template. BulkSendersSmsProvider resolves the template as
 * `variables.dltTemplate` (explicit override) → this map → the legacy OTP meta shape.
 * An SMS whose event maps to nothing is refused — free text can never reach the gateway.
 */
export const EVENT_DLT_MAP = Object.freeze({
  AppointmentCreated: 'APPOINTMENT_CONFIRMED',
  AppointmentConfirmed: 'APPOINTMENT_CONFIRMED',
  AppointmentReminder: 'APPOINTMENT_REMINDER',
  AppointmentCancelled: 'APPOINTMENT_CANCELLED',
  AppointmentRescheduled: 'APPOINTMENT_RESCHEDULED',
  AppointmentCompleted: 'VISIT_COMPLETED',
  PatientCheckedIn: 'CHECK_IN_SUCCESS',
  QueueTokenCalled: 'TOKEN_CALLED',
  PatientRegistered: 'REGISTRATION_SUCCESS',
  PrescriptionFinalized: 'PRESCRIPTION_READY',
  InvoiceCreated: 'INVOICE_GENERATED',
  InvoiceFinalized: 'INVOICE_GENERATED',
  InvoicePaid: 'PAYMENT_RECEIVED',
  FollowUpDue: 'FOLLOW_UP_REMINDER',
  TreatmentSessionReminder: 'TREATMENT_REMINDER',
});
