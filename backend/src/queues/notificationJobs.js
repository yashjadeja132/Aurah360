import { Worker } from 'bullmq';
import { getQueue, getBullConnection, QUEUE_NAMES } from './connection.js';
import { attachDeadLetterHandler } from './dlq.js';
import logger from '../libs/logger.js';

export const NOTIFICATION_JOBS = Object.freeze({
  DISPATCH: 'notification-dispatch',
  RETRY: 'notification-retry',
  DAILY_BIRTHDAY: 'daily-birthday-scan',
});

export async function enqueueNotificationDispatch(notificationMongoId, { delayMs = 0 } = {}) {
  try {
    const queue = getQueue(QUEUE_NAMES.NOTIFICATIONS);
    const opts = {
      jobId: `ntf-dispatch-${notificationMongoId}-${delayMs || 'now'}`,
      removeOnComplete: 200,
      removeOnFail: 100,
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
    };
    if (delayMs > 0) opts.delay = delayMs;
    await queue.add(
      NOTIFICATION_JOBS.DISPATCH,
      { notificationId: notificationMongoId },
      opts
    );
    return true;
  } catch (err) {
    logger.warn('Notification dispatch not enqueued (Redis?)', {
      message: err.message,
      notificationMongoId,
    });
    return false;
  }
}

export async function ensureBirthdayScanJob() {
  try {
    const queue = getQueue(QUEUE_NAMES.NOTIFICATIONS);
    const existing = await queue.getRepeatableJobs();
    if (existing.some((j) => j.name === NOTIFICATION_JOBS.DAILY_BIRTHDAY)) return;
    await queue.add(
      NOTIFICATION_JOBS.DAILY_BIRTHDAY,
      { type: 'birthday' },
      {
        repeat: { pattern: '0 9 * * *' },
        jobId: 'ntf-daily-birthday',
      }
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
