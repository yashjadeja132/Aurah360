import { Worker } from 'bullmq';
import { getQueue, getBullConnection, QUEUE_NAMES } from './connection.js';
import { attachDeadLetterHandler } from './dlq.js';
import logger from '../libs/logger.js';
import Appointment from '../models/Appointment.model.js';
import { APPOINTMENT_STATUS } from '../enums/appointment.js';
import NotificationService from '../services/NotificationService.js';

export const APPOINTMENT_REMINDER_JOBS = Object.freeze({
  SCAN: 'appointment-reminder-scan',
});

/** Reminders only make sense for appointments that are actually going to happen. */
const REMINDABLE_STATUSES = [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.SCHEDULED];

/** Repeat cadence for the scan — also used as a look-ahead buffer so no appointment falls
 *  through the gap between two consecutive runs. */
const SCAN_REPEAT_PATTERN = '*/15 * * * *'; // every 15 minutes
const SCAN_BUFFER_MINUTES = 30;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** appointmentDate (stored at midnight) + startTime ("HH:mm") → exact appointment instant. */
function appointmentDateTime(appointment) {
  const date = new Date(appointment.appointmentDate);
  const time = appointment.startTime || '00:00';
  const [h, m] = String(time).split(':').map(Number);
  date.setHours(h || 0, m || 0, 0, 0);
  return date;
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Shape NotificationService#sendAppointmentReminder / #appointmentVars expects. */
function toReminderPayload(appt) {
  const patient =
    appt.patientId && typeof appt.patientId === 'object' && appt.patientId.fullName !== undefined
      ? appt.patientId
      : null;
  return {
    id: appt._id.toString(),
    appointmentNumber: appt.appointmentNumber,
    patientId: patient ? patient._id.toString() : appt.patientId?.toString?.() || appt.patientId,
    patient: patient ? { fullName: patient.fullName } : null,
    appointmentDate: appt.appointmentDate,
    date: appt.appointmentDate,
    startTime: appt.startTime,
  };
}

/**
 * Core scan — finds CONFIRMED/SCHEDULED appointments due a 24h-before or same-day reminder
 * and dispatches NotificationService#sendAppointmentReminder exactly once per appointment.
 * Dedup is via the reminder24hSentAt / reminderSameDaySentAt flags on the Appointment doc,
 * so calling this repeatedly (or twice in a row) never double-sends.
 */
export async function scanAndSendAppointmentReminders({ now = new Date(), notificationService = null } = {}) {
  const service = notificationService || new NotificationService();
  const results = { scanned: 0, sent24h: 0, sentSameDay: 0, errors: [] };

  // —— 24-hours-before reminder ——
  const windowEnd24h = new Date(now.getTime() + 24 * 60 * 60 * 1000 + SCAN_BUFFER_MINUTES * 60 * 1000);
  const due24h = await Appointment.find({
    deletedAt: null,
    status: { $in: REMINDABLE_STATUSES },
    reminder24hSentAt: null,
    appointmentDate: { $gte: startOfDay(now), $lte: windowEnd24h },
  })
    .populate('patientId', 'firstName lastName middleName mobile email')
    .limit(500)
    .exec();

  for (const appt of due24h) {
    const dt = appointmentDateTime(appt);
    if (dt <= now || dt > windowEnd24h) continue;
    results.scanned += 1;
    try {
      await service.sendAppointmentReminder(toReminderPayload(appt));
      appt.reminder24hSentAt = now;
      await appt.save();
      results.sent24h += 1;
    } catch (err) {
      results.errors.push({ appointmentId: appt._id.toString(), stage: '24h', message: err.message });
      logger.warn('24h appointment reminder failed', {
        appointmentId: appt._id.toString(),
        message: err.message,
      });
    }
  }

  // —— Same-day reminder ——
  const dueSameDay = await Appointment.find({
    deletedAt: null,
    status: { $in: REMINDABLE_STATUSES },
    reminderSameDaySentAt: null,
    appointmentDate: { $gte: startOfDay(now), $lte: endOfDay(now) },
  })
    .populate('patientId', 'firstName lastName middleName mobile email')
    .limit(500)
    .exec();

  for (const appt of dueSameDay) {
    const dt = appointmentDateTime(appt);
    if (dt <= now || !isSameDay(dt, now)) continue;
    results.scanned += 1;
    try {
      await service.sendAppointmentReminder(toReminderPayload(appt));
      appt.reminderSameDaySentAt = now;
      await appt.save();
      results.sentSameDay += 1;
    } catch (err) {
      results.errors.push({ appointmentId: appt._id.toString(), stage: 'sameDay', message: err.message });
      logger.warn('Same-day appointment reminder failed', {
        appointmentId: appt._id.toString(),
        message: err.message,
      });
    }
  }

  return results;
}

/** Repeatable scan, registered once — mirrors crmJobs.js's ensureDailyFollowUpScan. */
export async function ensureAppointmentReminderScan() {
  try {
    const queue = getQueue(QUEUE_NAMES.APPOINTMENT_REMINDERS);
    const existing = await queue.getRepeatableJobs();
    const already = existing.some((j) => j.name === APPOINTMENT_REMINDER_JOBS.SCAN);
    if (already) return;
    await queue.add(
      APPOINTMENT_REMINDER_JOBS.SCAN,
      { type: 'scan' },
      {
        repeat: { pattern: SCAN_REPEAT_PATTERN },
        jobId: 'appointment-reminder-scan',
      }
    );
    logger.info('Appointment reminder scan scheduled', { pattern: SCAN_REPEAT_PATTERN });
  } catch (err) {
    logger.warn('Appointment reminder scan not scheduled', { message: err.message });
  }
}

let worker = null;

export function startAppointmentReminderWorker() {
  if (worker) return worker;

  worker = new Worker(
    QUEUE_NAMES.APPOINTMENT_REMINDERS,
    async (job) => {
      if (job.name === APPOINTMENT_REMINDER_JOBS.SCAN) {
        const result = await scanAndSendAppointmentReminders();
        logger.info('Appointment reminder scan job', result);
        return result;
      }
      return { ignored: true };
    },
    { connection: getBullConnection() }
  );

  attachDeadLetterHandler(worker, QUEUE_NAMES.APPOINTMENT_REMINDERS);

  ensureAppointmentReminderScan().catch(() => {});

  logger.info('Appointment reminder BullMQ worker started');
  return worker;
}

export default {
  scanAndSendAppointmentReminders,
  ensureAppointmentReminderScan,
  startAppointmentReminderWorker,
  APPOINTMENT_REMINDER_JOBS,
};
