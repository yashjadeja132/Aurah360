/**
 * Module 15 seed — default templates, queued reminders, sample delivery logs.
 */
import NotificationTemplate from '../models/NotificationTemplate.model.js';
import Notification from '../models/Notification.model.js';
import User from '../models/User.model.js';
import Patient from '../models/Patient.model.js';
import { generateNotificationId } from '../helpers/notificationNumber.helper.js';
import {
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  TEMPLATE_CODE,
} from '../enums/notification.js';
import logger from '../libs/logger.js';

const DEFAULT_TEMPLATES = [
  {
    code: TEMPLATE_CODE.APPOINTMENT_CONFIRMATION,
    name: 'Appointment Confirmation',
    eventName: 'AppointmentCreated',
    subject: 'Appointment confirmed — {{appointmentNumber}}',
    body: 'Hi {{patientName}}, your appointment {{appointmentNumber}} is confirmed for {{date}} {{time}}.',
    variables: ['patientName', 'appointmentNumber', 'date', 'time'],
  },
  {
    code: TEMPLATE_CODE.APPOINTMENT_REMINDER,
    name: 'Appointment Reminder',
    eventName: 'AppointmentReminder',
    subject: 'Reminder: appointment {{appointmentNumber}}',
    body: 'Reminder: {{patientName}}, you have an appointment {{appointmentNumber}} on {{date}} at {{time}}.',
    variables: ['patientName', 'appointmentNumber', 'date', 'time'],
  },
  {
    code: TEMPLATE_CODE.FOLLOW_UP_REMINDER,
    name: 'Follow-up Reminder',
    eventName: 'FollowUpDue',
    subject: 'Follow-up due — {{leadNumber}}',
    body: 'Follow-up due for lead {{leadNumber}}. Summary: {{summary}}',
    variables: ['leadNumber', 'summary'],
  },
  {
    code: TEMPLATE_CODE.INVOICE_GENERATED,
    name: 'Invoice Generated',
    eventName: 'InvoiceCreated',
    subject: 'Invoice {{invoiceNumber}} generated',
    body: 'Invoice {{invoiceNumber}} has been generated. {{summary}}',
    variables: ['invoiceNumber', 'summary'],
  },
  {
    code: TEMPLATE_CODE.INVOICE_PAID,
    name: 'Invoice Paid',
    eventName: 'InvoicePaid',
    subject: 'Payment received — {{invoiceNumber}}',
    body: 'Thank you. Payment received for invoice {{invoiceNumber}}.',
    variables: ['invoiceNumber'],
  },
  {
    code: TEMPLATE_CODE.TREATMENT_SESSION_REMINDER,
    name: 'Treatment Session Reminder',
    eventName: 'TreatmentSessionReminder',
    subject: 'Treatment reminder — {{sessionNumber}}',
    body: 'Reminder for treatment session {{sessionNumber}} on {{date}}.',
    variables: ['sessionNumber', 'date'],
  },
  {
    code: TEMPLATE_CODE.PRESCRIPTION_READY,
    name: 'Prescription Ready',
    eventName: 'PrescriptionFinalized',
    subject: 'Prescription ready',
    body: 'Your prescription is ready for collection. {{summary}}',
    variables: ['summary'],
  },
  {
    code: TEMPLATE_CODE.BIRTHDAY_WISHES,
    name: 'Birthday Wishes',
    eventName: 'BirthdayWishes',
    subject: 'Happy Birthday {{patientName}}!',
    body: 'Happy Birthday {{patientName}}! Wishing you glowing health from Aurah 360.',
    variables: ['patientName'],
  },
  {
    code: TEMPLATE_CODE.LEAD_FOLLOW_UP,
    name: 'Lead Follow-up',
    eventName: 'FollowUpDue',
    subject: 'CRM follow-up — {{leadNumber}}',
    body: 'Lead {{leadNumber}} follow-up is due. {{summary}}',
    variables: ['leadNumber', 'summary'],
  },
  {
    code: TEMPLATE_CODE.LEAD_CREATED,
    name: 'Lead Created',
    eventName: 'LeadCreated',
    subject: 'New lead {{leadNumber}}',
    body: 'New lead {{leadNumber}} created. {{summary}}',
    variables: ['leadNumber', 'summary'],
  },
  {
    code: TEMPLATE_CODE.LEAD_CONVERTED,
    name: 'Lead Converted',
    eventName: 'LeadConverted',
    subject: 'Lead converted — {{leadNumber}}',
    body: 'Lead {{leadNumber}} converted to patient {{mrn}}.',
    variables: ['leadNumber', 'mrn'],
  },
  {
    code: TEMPLATE_CODE.TREATMENT_SESSION_COMPLETED,
    name: 'Treatment Session Completed',
    eventName: 'TreatmentSessionCompleted',
    subject: 'Session completed — {{sessionNumber}}',
    body: 'Treatment session {{sessionNumber}} has been completed.',
    variables: ['sessionNumber'],
  },
  {
    code: TEMPLATE_CODE.PATIENT_CHECKED_IN,
    name: 'Patient Checked In',
    eventName: 'PatientCheckedIn',
    subject: 'Patient checked in',
    body: 'Patient checked in. {{summary}}',
    variables: ['summary'],
  },
  {
    code: TEMPLATE_CODE.CONSULTATION_SIGNED,
    name: 'Consultation Signed',
    eventName: 'ConsultationSigned',
    subject: 'Consultation signed',
    body: 'Consultation has been signed. {{summary}}',
    variables: ['summary'],
  },
  {
    code: TEMPLATE_CODE.TREATMENT_PLAN_ACCEPTED,
    name: 'Treatment Plan Accepted',
    eventName: 'TreatmentPlanAccepted',
    subject: 'Treatment plan accepted',
    body: 'Treatment plan accepted. {{summary}}',
    variables: ['summary'],
  },
];

export async function seedModule15() {
  for (const tpl of DEFAULT_TEMPLATES) {
    await NotificationTemplate.findOneAndUpdate(
      { code: tpl.code },
      {
        $set: {
          ...tpl,
          channel: 'ALL',
          isActive: true,
          deletedAt: null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  logger.info('Module 15 templates seeded', { count: DEFAULT_TEMPLATES.length });

  const existing = await Notification.countDocuments();
  if (existing >= 30) {
    logger.info('Module 15 notifications already seeded', { existing });
    return;
  }

  const admin = await User.findOne({ email: 'admin@aurah360.local' }).exec();
  const patient = await Patient.findOne({ deletedAt: null }).exec();
  const templates = await NotificationTemplate.find({ deletedAt: null }).limit(10).exec();

  // Sample sent / failed / queued logs
  for (let i = 0; i < 20; i += 1) {
    const tpl = templates[i % templates.length];
    const channel = [
      NOTIFICATION_CHANNEL.IN_APP,
      NOTIFICATION_CHANNEL.SMS,
      NOTIFICATION_CHANNEL.EMAIL,
      NOTIFICATION_CHANNEL.WHATSAPP,
    ][i % 4];
    const status = [
      NOTIFICATION_STATUS.SENT,
      NOTIFICATION_STATUS.SENT,
      NOTIFICATION_STATUS.FAILED,
      NOTIFICATION_STATUS.QUEUED,
      NOTIFICATION_STATUS.SCHEDULED,
    ][i % 5];

    await Notification.create({
      notificationId: await generateNotificationId(),
      eventName: tpl.eventName || 'SeedEvent',
      patientId: patient?._id || null,
      userId: channel === NOTIFICATION_CHANNEL.IN_APP ? admin?._id : null,
      recipient:
        channel === NOTIFICATION_CHANNEL.EMAIL
          ? admin?.email || 'admin@aurah360.local'
          : channel === NOTIFICATION_CHANNEL.IN_APP
            ? admin?._id?.toString() || 'system'
            : patient?.mobile || '9800000000',
      channel,
      templateId: tpl._id,
      templateCode: tpl.code,
      subject: tpl.subject?.replace(/\{\{[^}]+\}\}/g, 'Sample') || 'Seed notification',
      message: tpl.body?.replace(/\{\{[^}]+\}\}/g, 'Sample') || 'Seed message',
      variables: { summary: 'Seed sample' },
      status,
      scheduledAt:
        status === NOTIFICATION_STATUS.SCHEDULED
          ? new Date(Date.now() + (i + 1) * 3600000)
          : null,
      sentAt: status === NOTIFICATION_STATUS.SENT ? new Date() : null,
      failedReason: status === NOTIFICATION_STATUS.FAILED ? 'Seed mock failure' : null,
      retryCount: status === NOTIFICATION_STATUS.FAILED ? 1 : 0,
      readAt: channel === NOTIFICATION_CHANNEL.IN_APP && i % 3 === 0 ? new Date() : null,
      providerResponse:
        status === NOTIFICATION_STATUS.SENT
          ? { provider: `mock-${channel.toLowerCase()}`, messageId: `seed-${i}` }
          : null,
    });
  }

  // Queued reminders (scheduled)
  for (let i = 0; i < 5; i += 1) {
    await Notification.create({
      notificationId: await generateNotificationId(),
      eventName: 'AppointmentReminder',
      patientId: patient?._id || null,
      userId: admin?._id || null,
      recipient: patient?.mobile || '9800000000',
      channel: NOTIFICATION_CHANNEL.SMS,
      templateCode: TEMPLATE_CODE.APPOINTMENT_REMINDER,
      subject: 'Appointment reminder',
      message: 'Seed delayed appointment reminder',
      variables: { appointmentNumber: `APT-SEED-${i}` },
      status: NOTIFICATION_STATUS.SCHEDULED,
      scheduledAt: new Date(Date.now() + (i + 1) * 86400000),
    });
  }

  logger.info('Module 15 notifications seeded', {
    notifications: await Notification.countDocuments(),
  });
}

export default seedModule15;
