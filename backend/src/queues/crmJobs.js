import { getQueue, enqueueJob, QUEUE_NAMES } from './connection.js';
import logger from '../libs/logger.js';

export const CRM_JOBS = Object.freeze({
  FOLLOW_UP_REMINDER: 'follow-up-reminder',
  DAILY_FOLLOW_UP_SCAN: 'daily-follow-up-scan',
});

/** Called from CrmService on the request path — must not block the response. */
export async function scheduleFollowUpReminder(leadId, when) {
  const runAt = new Date(when);
  const delay = Math.max(0, runAt.getTime() - Date.now());
  await enqueueJob(
    QUEUE_NAMES.CRM,
    CRM_JOBS.FOLLOW_UP_REMINDER,
    { leadId, scheduledFor: runAt.toISOString() },
    {
      jobId: `crm-followup-${leadId}-${runAt.getTime()}`,
      delay,
      removeOnComplete: true,
    }
  );
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

/**
 * Registers onto the shared CRM queue worker. This module used to own a Worker on QUEUE_NAMES.CRM
 * and so did missedFollowUpJobs, so each was silently swallowing about half of the other's jobs.
 * See queues/composeWorker.js.
 */
export const crmHandlerModule = {
  jobNames: [CRM_JOBS.FOLLOW_UP_REMINDER, CRM_JOBS.DAILY_FOLLOW_UP_SCAN],
  ensure: ensureDailyFollowUpScan,
  handle: async (job) => {
    const { default: CrmService } = await import('../services/CrmService.js');
    const service = new CrmService();
    const result = await service.processFollowUpReminders();
    logger.info('CRM follow-up job', {
      jobName: job.name,
      leadId: job.data?.leadId,
      processed: result.processed,
    });
    return result;
  },
};

export default {
  scheduleFollowUpReminder,
  crmHandlerModule,
  CRM_JOBS,
};
