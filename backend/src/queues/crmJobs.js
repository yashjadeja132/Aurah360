import { Worker } from 'bullmq';
import { getQueue, getBullConnection, QUEUE_NAMES } from './connection.js';
import { attachDeadLetterHandler } from './dlq.js';
import logger from '../libs/logger.js';

export const CRM_JOBS = Object.freeze({
  FOLLOW_UP_REMINDER: 'follow-up-reminder',
  DAILY_FOLLOW_UP_SCAN: 'daily-follow-up-scan',
});

export async function scheduleFollowUpReminder(leadId, when) {
  try {
    const queue = getQueue(QUEUE_NAMES.CRM);
    const runAt = new Date(when);
    const delay = Math.max(0, runAt.getTime() - Date.now());
    await queue.add(
      CRM_JOBS.FOLLOW_UP_REMINDER,
      { leadId, scheduledFor: runAt.toISOString() },
      {
        jobId: `crm-followup-${leadId}-${runAt.getTime()}`,
        delay,
        removeOnComplete: true,
      }
    );
  } catch (err) {
    logger.warn('CRM follow-up reminder not scheduled (Redis?)', { message: err.message, leadId });
  }
}

/** Repeatable daily scan for due/missed follow-ups */
export async function ensureDailyFollowUpScan() {
  try {
    const queue = getQueue(QUEUE_NAMES.CRM);
    const existing = await queue.getRepeatableJobs();
    const already = existing.some((j) => j.name === CRM_JOBS.DAILY_FOLLOW_UP_SCAN);
    if (already) return;
    await queue.add(
      CRM_JOBS.DAILY_FOLLOW_UP_SCAN,
      { type: 'daily' },
      {
        repeat: { pattern: '0 8 * * *' }, // 08:00 daily
        jobId: 'crm-daily-follow-up-scan',
      }
    );
    logger.info('CRM daily follow-up scan scheduled');
  } catch (err) {
    logger.warn('CRM daily scan not scheduled', { message: err.message });
  }
}

let worker = null;

export function startCrmWorker() {
  if (worker) return worker;

  worker = new Worker(
    QUEUE_NAMES.CRM,
    async (job) => {
      const { default: CrmService } = await import('../services/CrmService.js');
      const service = new CrmService();

      if (job.name === CRM_JOBS.FOLLOW_UP_REMINDER) {
        const result = await service.processFollowUpReminders();
        logger.info('CRM follow-up reminder job', {
          leadId: job.data?.leadId,
          processed: result.processed,
        });
        return result;
      }

      if (job.name === CRM_JOBS.DAILY_FOLLOW_UP_SCAN) {
        const result = await service.processFollowUpReminders();
        logger.info('CRM daily follow-up scan', { processed: result.processed });
        return result;
      }

      return { ignored: true };
    },
    { connection: getBullConnection() }
  );

  attachDeadLetterHandler(worker, QUEUE_NAMES.CRM);

  ensureDailyFollowUpScan().catch(() => {});

  logger.info('CRM BullMQ worker started');
  return worker;
}

export default {
  scheduleFollowUpReminder,
  startCrmWorker,
  CRM_JOBS,
};
