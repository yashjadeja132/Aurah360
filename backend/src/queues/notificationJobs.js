import { Worker } from 'bullmq';
import { getBullConnection, enqueueJob, QUEUE_NAMES, ensureRepeatableJob } from './connection.js';
import { attachDeadLetterHandler } from './dlq.js';
import logger from '../libs/logger.js';

export const NOTIFICATION_JOBS = Object.freeze({
  DISPATCH: 'notification-dispatch',
  RETRY: 'notification-retry',
  DAILY_BIRTHDAY: 'daily-birthday-scan',
});

/** Called from request paths (appointment cancel, invoice finalize, …), so it must never
 *  block the response — enqueueJob bounds the wait and fails open. */
export async function enqueueNotificationDispatch(notificationMongoId, { delayMs = 0 } = {}) {
  const opts = {
    jobId: `ntf-dispatch-${notificationMongoId}-${delayMs || 'now'}`,
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
  };
  if (delayMs > 0) opts.delay = delayMs;
  const job = await enqueueJob(
    QUEUE_NAMES.NOTIFICATIONS,
    NOTIFICATION_JOBS.DISPATCH,
    { notificationId: notificationMongoId },
    opts
  );
  return Boolean(job);
}

/**
 * 09:00 CLINIC time. Whose birthday it is depends on the clinic's calendar day, and a patient
 * greeted at 14:30 IST (09:00 UTC) has had most of their birthday already.
 */
export async function ensureBirthdayScanJob() {
  try {
    await ensureRepeatableJob(
      QUEUE_NAMES.NOTIFICATIONS,
      NOTIFICATION_JOBS.DAILY_BIRTHDAY,
      { type: 'birthday' },
      { pattern: '0 9 * * *', jobId: 'ntf-daily-birthday' }
    );
    logger.info('Notification birthday scan scheduled');
  } catch (err) {
    logger.warn('Birthday scan not scheduled', { message: err.message });
  }
}

let worker = null;

export function startNotificationWorker() {
  if (worker) return worker;

  worker = new Worker(
    QUEUE_NAMES.NOTIFICATIONS,
    async (job) => {
      const { default: NotificationService } = await import(
        '../services/NotificationService.js'
      );
      const service = new NotificationService();

      if (job.name === NOTIFICATION_JOBS.DISPATCH || job.name === NOTIFICATION_JOBS.RETRY) {
        return service.dispatchOne(job.data.notificationId);
      }
      if (job.name === NOTIFICATION_JOBS.DAILY_BIRTHDAY) {
        return service.processBirthdayReminders();
      }
      return { ignored: true };
    },
    { connection: getBullConnection() }
  );

  attachDeadLetterHandler(worker, QUEUE_NAMES.NOTIFICATIONS);

  ensureBirthdayScanJob().catch(() => {});
  logger.info('Notification BullMQ worker started');
  return worker;
}

export default {
  enqueueNotificationDispatch,
  startNotificationWorker,
  NOTIFICATION_JOBS,
};
