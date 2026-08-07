/**
 * Module 17 seed — enable 5 patient portal accounts + sample feedback/notifications.
 * Reuses existing patients, appointments, invoices (no business-data duplication).
 */
import Patient from '../models/Patient.model.js';
import PatientFeedback from '../models/PatientFeedback.model.js';
import Notification from '../models/Notification.model.js';
import Appointment from '../models/Appointment.model.js';
import Invoice from '../models/Invoice.model.js';
import { hashPassword } from '../helpers/crypto.helper.js';
import { generateNotificationId } from '../helpers/notificationNumber.helper.js';
import { NOTIFICATION_CHANNEL, NOTIFICATION_STATUS } from '../enums/notification.js';
import logger from '../libs/logger.js';

const PORTAL_PASSWORD = process.env.SEED_PATIENT_PASSWORD || 'Patient@12345';

export async function seedModule17() {
  const patients = await Patient.find({ deletedAt: null, email: { $ne: null } })
    .sort({ createdAt: 1 })
    .limit(5);

  if (patients.length < 1) {
    logger.warn('Module 17 seed skipped — no patients with email');
    return;
  }

  const passwordHash = await hashPassword(PORTAL_PASSWORD);
  let enabled = 0;

  for (const p of patients) {
    await Patient.updateOne(
      { _id: p._id },
      {
        $set: {
          passwordHash,
          portalEnabled: true,
          emailVerified: true,
        },
      }
    );
    enabled += 1;

    const existingFeedback = await PatientFeedback.countDocuments({
      patientId: p._id,
      deletedAt: null,
    });
    if (existingFeedback === 0) {
      await PatientFeedback.create({
        patientId: p._id,
        clinicRating: 5,
        doctorRating: 4,
        comments: 'Great care at Aurah 360.',
        suggestions: 'Keep evening slots open.',
      });
    }

    const existingNotif = await Notification.countDocuments({
      patientId: p._id,
      channel: NOTIFICATION_CHANNEL.IN_APP,
    });
    if (existingNotif === 0) {
      await Notification.create({
        notificationId: await generateNotificationId(),
        eventName: 'PortalWelcome',
        patientId: p._id,
        recipient: p.email || p.mobile,
        channel: NOTIFICATION_CHANNEL.IN_APP,
        subject: 'Welcome to Patient Portal',
        message: `Hi ${p.firstName}, your portal account is ready. Login with your email and the seed password.`,
        status: NOTIFICATION_STATUS.SENT,
        sentAt: new Date(),
      });
    }
  }

  const withAppts = await Appointment.countDocuments({
    patientId: { $in: patients.map((p) => p._id) },
    deletedAt: null,
  });
  const withInvoices = await Invoice.countDocuments({
    patientId: { $in: patients.map((p) => p._id) },
    deletedAt: null,
  });

  logger.info('Module 17 patient portal seeded', {
    accounts: enabled,
    passwordHint: 'SEED_PATIENT_PASSWORD or Patient@12345',
    emails: patients.map((p) => p.email),
    linkedAppointments: withAppts,
    linkedInvoices: withInvoices,
  });
}

export default seedModule17;
