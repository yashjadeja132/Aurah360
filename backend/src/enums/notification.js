export const NOTIFICATION_CHANNEL = Object.freeze({
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  WHATSAPP: 'WHATSAPP',
  IN_APP: 'IN_APP',
  PUSH: 'PUSH',
  VOICE: 'VOICE',
});

export const NOTIFICATION_CHANNEL_LIST = Object.freeze(Object.values(NOTIFICATION_CHANNEL));

export const NOTIFICATION_STATUS = Object.freeze({
  QUEUED: 'QUEUED',
  SCHEDULED: 'SCHEDULED',
  SENDING: 'SENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
});

export const NOTIFICATION_STATUS_LIST = Object.freeze(Object.values(NOTIFICATION_STATUS));

export const TEMPLATE_CODE = Object.freeze({
  APPOINTMENT_CONFIRMATION: 'APPOINTMENT_CONFIRMATION',
  APPOINTMENT_REMINDER: 'APPOINTMENT_REMINDER',
  FOLLOW_UP_REMINDER: 'FOLLOW_UP_REMINDER',
  INVOICE_GENERATED: 'INVOICE_GENERATED',
  INVOICE_PAID: 'INVOICE_PAID',
  TREATMENT_SESSION_REMINDER: 'TREATMENT_SESSION_REMINDER',
  PRESCRIPTION_READY: 'PRESCRIPTION_READY',
  BIRTHDAY_WISHES: 'BIRTHDAY_WISHES',
  LEAD_FOLLOW_UP: 'LEAD_FOLLOW_UP',
  LEAD_CREATED: 'LEAD_CREATED',
  LEAD_CONVERTED: 'LEAD_CONVERTED',
  TREATMENT_SESSION_COMPLETED: 'TREATMENT_SESSION_COMPLETED',
  PATIENT_CHECKED_IN: 'PATIENT_CHECKED_IN',
  CONSULTATION_SIGNED: 'CONSULTATION_SIGNED',
  TREATMENT_PLAN_ACCEPTED: 'TREATMENT_PLAN_ACCEPTED',
  FEEDBACK_REQUEST: 'FEEDBACK_REQUEST',
});

export const TEMPLATE_CODE_LIST = Object.freeze(Object.values(TEMPLATE_CODE));

/** Map domain / logical event names → template codes */
export const EVENT_TEMPLATE_MAP = Object.freeze({
  AppointmentCreated: TEMPLATE_CODE.APPOINTMENT_CONFIRMATION,
  AppointmentConfirmed: TEMPLATE_CODE.APPOINTMENT_CONFIRMATION,
  AppointmentReminder: TEMPLATE_CODE.APPOINTMENT_REMINDER,
  PatientCheckedIn: TEMPLATE_CODE.PATIENT_CHECKED_IN,
  ConsultationSigned: TEMPLATE_CODE.CONSULTATION_SIGNED,
  PrescriptionFinalized: TEMPLATE_CODE.PRESCRIPTION_READY,
  TreatmentPlanAccepted: TEMPLATE_CODE.TREATMENT_PLAN_ACCEPTED,
  InvoiceCreated: TEMPLATE_CODE.INVOICE_GENERATED,
  InvoiceFinalized: TEMPLATE_CODE.INVOICE_GENERATED,
  InvoicePaid: TEMPLATE_CODE.INVOICE_PAID,
  TreatmentSessionCompleted: TEMPLATE_CODE.TREATMENT_SESSION_COMPLETED,
  TreatmentSessionReminder: TEMPLATE_CODE.TREATMENT_SESSION_REMINDER,
  LeadCreated: TEMPLATE_CODE.LEAD_CREATED,
  LeadConverted: TEMPLATE_CODE.LEAD_CONVERTED,
  FollowUpDue: TEMPLATE_CODE.LEAD_FOLLOW_UP,
  BirthdayWishes: TEMPLATE_CODE.BIRTHDAY_WISHES,
  FeedbackRequested: TEMPLATE_CODE.FEEDBACK_REQUEST,
});

export const DEFAULT_EVENT_CHANNELS = Object.freeze({
  AppointmentCreated: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.SMS, NOTIFICATION_CHANNEL.WHATSAPP],
  AppointmentConfirmed: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.SMS],
  AppointmentReminder: [NOTIFICATION_CHANNEL.SMS, NOTIFICATION_CHANNEL.WHATSAPP, NOTIFICATION_CHANNEL.IN_APP],
  PatientCheckedIn: [NOTIFICATION_CHANNEL.IN_APP],
  ConsultationSigned: [NOTIFICATION_CHANNEL.IN_APP],
  PrescriptionFinalized: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.SMS],
  TreatmentPlanAccepted: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
  InvoiceCreated: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
  InvoiceFinalized: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
  InvoicePaid: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.SMS, NOTIFICATION_CHANNEL.EMAIL],
  TreatmentSessionCompleted: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.WHATSAPP],
  TreatmentSessionReminder: [NOTIFICATION_CHANNEL.SMS, NOTIFICATION_CHANNEL.IN_APP],
  LeadCreated: [NOTIFICATION_CHANNEL.IN_APP],
  LeadConverted: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL],
  FollowUpDue: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.SMS],
  BirthdayWishes: [NOTIFICATION_CHANNEL.WHATSAPP, NOTIFICATION_CHANNEL.SMS, NOTIFICATION_CHANNEL.IN_APP],
  FeedbackRequested: [NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.WHATSAPP, NOTIFICATION_CHANNEL.SMS],
});

export const NOTIFICATION_EVENTS = Object.freeze({
  QUEUED: 'NotificationQueued',
  SENT: 'NotificationSent',
  FAILED: 'NotificationFailed',
  DELIVERY_UPDATED: 'NotificationDeliveryUpdated',
});

/** Category separates transactional/service from marketing (NTF-006, §12.4) */
export const NOTIFICATION_CATEGORY = Object.freeze({
  TRANSACTIONAL: 'TRANSACTIONAL',
  MARKETING: 'MARKETING',
  VOICE_REMINDER: 'VOICE_REMINDER',
});

export const NOTIFICATION_CATEGORY_LIST = Object.freeze(Object.values(NOTIFICATION_CATEGORY));

/** Templates that are always transactional/service — never suppressed by marketing opt-out. */
export const TRANSACTIONAL_TEMPLATE_CODES = Object.freeze([
  TEMPLATE_CODE.APPOINTMENT_CONFIRMATION,
  TEMPLATE_CODE.APPOINTMENT_REMINDER,
  TEMPLATE_CODE.FOLLOW_UP_REMINDER,
  TEMPLATE_CODE.INVOICE_GENERATED,
  TEMPLATE_CODE.INVOICE_PAID,
  TEMPLATE_CODE.TREATMENT_SESSION_REMINDER,
  TEMPLATE_CODE.PRESCRIPTION_READY,
  TEMPLATE_CODE.TREATMENT_SESSION_COMPLETED,
  TEMPLATE_CODE.PATIENT_CHECKED_IN,
  TEMPLATE_CODE.CONSULTATION_SIGNED,
  TEMPLATE_CODE.TREATMENT_PLAN_ACCEPTED,
  // A post-visit feedback/NPS request is service-adjacent, not marketing — it's about the visit
  // the patient just had, not an outbound campaign — so it is never suppressed by
  // marketingConsent being false, same as the other post-visit templates above.
  TEMPLATE_CODE.FEEDBACK_REQUEST,
]);

export const MARKETING_TEMPLATE_CODES = Object.freeze([
  TEMPLATE_CODE.BIRTHDAY_WISHES,
  TEMPLATE_CODE.LEAD_FOLLOW_UP,
  TEMPLATE_CODE.LEAD_CREATED,
  TEMPLATE_CODE.LEAD_CONVERTED,
]);

/** Delivery/webhook lifecycle (NTF-005) */
export const DELIVERY_EVENT_TYPE = Object.freeze({
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  REPLIED: 'REPLIED',
  CALL_ANSWERED: 'CALL_ANSWERED',
  CALL_NO_ANSWER: 'CALL_NO_ANSWER',
  OPTED_OUT: 'OPTED_OUT',
});

export const DELIVERY_EVENT_TYPE_LIST = Object.freeze(Object.values(DELIVERY_EVENT_TYPE));

export const NOTIFICATION_PROVIDER = Object.freeze({
  MOCK: 'MOCK',
  WHATSAPP_CLOUD: 'WHATSAPP_CLOUD',
  SMS_DLT: 'SMS_DLT',
  VOICE_EXOTEL: 'VOICE_EXOTEL',
  SMTP: 'SMTP',
  FCM: 'FCM',
});

export const NOTIFICATION_PROVIDER_LIST = Object.freeze(Object.values(NOTIFICATION_PROVIDER));

/**
 * Cross-channel delivery fallback order (spec: "Fallback order (WhatsApp→SMS→voice)").
 * When a send on one of these channels fails, NotificationService escalates to the next
 * channel in this list (rather than only retrying the same dead channel). Channels not in
 * this list (EMAIL, IN_APP, PUSH) keep the existing same-channel retry behaviour — they have
 * no fallback hop defined for them.
 *
 * This is a deliberately hardcoded, org-wide default order (not currently editable per-org
 * from the admin UI); see NotificationTemplatesPanel/NotificationDeliveryLogPanel — there is
 * no settings panel yet to expose per-org reordering, so this is scoped as a fixed default.
 */
export const FALLBACK_CHANNEL_ORDER = Object.freeze([
  NOTIFICATION_CHANNEL.WHATSAPP,
  NOTIFICATION_CHANNEL.SMS,
  NOTIFICATION_CHANNEL.VOICE,
]);

/**
 * Returns the next channel to attempt after `channel` fails, following the
 * WhatsApp→SMS→voice fallback order, or `null` if `channel` isn't part of the chain
 * (e.g. EMAIL/IN_APP/PUSH) or is already the last hop (VOICE).
 */
export function getNextFallbackChannel(channel) {
  const idx = FALLBACK_CHANNEL_ORDER.indexOf(channel);
  if (idx === -1 || idx === FALLBACK_CHANNEL_ORDER.length - 1) return null;
  return FALLBACK_CHANNEL_ORDER[idx + 1];
}

/** WhatsApp Business template approval lifecycle (Meta/DLT approval workflow). */
export const WHATSAPP_APPROVAL_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

export const WHATSAPP_APPROVAL_STATUS_LIST = Object.freeze(
  Object.values(WHATSAPP_APPROVAL_STATUS)
);

/**
 * PHI / clinical-content guard (PRD high-risk rule): diagnosis, treatment, lab-value,
 * or clinical-photo content must never appear in WhatsApp/SMS/push/email template text.
 * Kept as a maintainable exported constant so ops can extend it without code changes
 * to the validator itself.
 *
 * Each entry is matched case-insensitively against template subject/body text, including
 * the text inside `{{mergeField}}` placeholders (so a merge field named `{{diagnosis}}`
 * is blocked even though it renders to variable content at send-time).
 */
export const PHI_BLOCKED_KEYWORDS = Object.freeze([
  'diagnosis',
  'diagnoses',
  'prognosis',
  'prescription',
  'biopsy',
  'histopathology',
  'clinical note',
  'clinicalnotes',
  'clinical notes',
  'treatment plan',
  'lab result',
  'lab value',
  'test result',
  'hiv',
  'std',
  'sti',
  'cancer',
  'tumor',
  'tumour',
  'malignant',
  'benign',
  'pathology',
  'medication',
  'dosage',
  'dose',
  'mg/dl',
  'mmhg',
  'blood pressure',
  'blood sugar',
  'hba1c',
  'photo attached',
  'clinical photo',
  'clinical image',
]);

/**
 * Merge-field names that are always PHI regardless of surrounding text, e.g.
 * `{{diagnosis}}` or `{{clinicalNotes}}`. Matched against the field name inside
 * `{{...}}` placeholders (case-insensitive, ignoring whitespace/punctuation).
 */
export const PHI_BLOCKED_MERGE_FIELDS = Object.freeze([
  'diagnosis',
  'diagnoses',
  'prognosis',
  'clinicalnotes',
  'clinicalnote',
  'treatmentplan',
  'labresult',
  'labresults',
  'labvalue',
  'testresult',
  'prescription',
  'medication',
  'dosage',
  'biopsy',
  'clinicalphoto',
  'clinicalimage',
]);

export default {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  TEMPLATE_CODE,
  EVENT_TEMPLATE_MAP,
  NOTIFICATION_CATEGORY,
  TRANSACTIONAL_TEMPLATE_CODES,
  MARKETING_TEMPLATE_CODES,
  DELIVERY_EVENT_TYPE,
  NOTIFICATION_PROVIDER,
  PHI_BLOCKED_KEYWORDS,
  PHI_BLOCKED_MERGE_FIELDS,
  FALLBACK_CHANNEL_ORDER,
  getNextFallbackChannel,
  WHATSAPP_APPROVAL_STATUS,
  WHATSAPP_APPROVAL_STATUS_LIST,
};
