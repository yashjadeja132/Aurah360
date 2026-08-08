import { Worker } from 'bullmq';
import { getBullConnection, enqueueJob, QUEUE_NAMES, ensureRepeatableJob } from './connection.js';
import { attachDeadLetterHandler } from './dlq.js';
import logger from '../libs/logger.js';

export const ANALYTICS_JOBS = Object.freeze({
  HEAVY_EXPORT: 'analytics-heavy-export',
  DAILY_DIGEST: 'analytics-daily-digest',
  WEEKLY_DIGEST: 'analytics-weekly-digest',
  MONTHLY_DIGEST: 'analytics-monthly-digest',
});

/** Called from the analytics request path — must not block the response. */
export async function enqueueAnalyticsExport({ category, format, query, actorId }) {
  const job = await enqueueJob(
    QUEUE_NAMES.ANALYTICS,
    ANALYTICS_JOBS.HEAVY_EXPORT,
    { category, format, query, actorId },
    {
      removeOnComplete: 50,
      removeOnFail: 100,
      attempts: 2,
    }
  );
  if (!job) {
    return { status: 'FAILED', message: 'Export could not be queued — background queue unavailable.' };
  }
  return { jobId: job.id, status: 'QUEUED', category, format };
}

/** 07:15 CLINIC time — digests must land before the clinic opens, not 07:15 UTC (12:45 IST). */
export async function ensureAnalyticsScheduledJobs() {
  try {
    await ensureRepeatableJob(QUEUE_NAMES.ANALYTICS, ANALYTICS_JOBS.DAILY_DIGEST, { period: 'daily' }, {
      pattern: '15 7 * * *',
      jobId: 'analytics-daily-digest',
    });
    await ensureRepeatableJob(QUEUE_NAMES.ANALYTICS, ANALYTICS_JOBS.WEEKLY_DIGEST, { period: 'weekly' }, {
      pattern: '15 7 * * 1',
      jobId: 'analytics-weekly-digest',
    });
    await ensureRepeatableJob(QUEUE_NAMES.ANALYTICS, ANALYTICS_JOBS.MONTHLY_DIGEST, { period: 'monthly' }, {
      pattern: '15 7 1 * *',
      jobId: 'analytics-monthly-digest',
    });
    logger.info('Analytics scheduled jobs ensured');
  } catch (err) {
    logger.warn('Analytics scheduled jobs not ensured', { message: err.message });
  }
}

/** Email delivery placeholder for scheduled digests */
async function runDigestPlaceholder(period) {
  logger.info('Analytics digest generated (email delivery placeholder)', { period });
  return {
    period,
    emailDelivery: 'placeholder',
    message: 'Digest computed; email provider not configured.',
  };
}

let worker = null;

export function startAnalyticsWorker() {
  if (worker) return worker;

  worker = new Worker(
    QUEUE_NAMES.ANALYTICS,
    async (job) => {
      if (job.name === ANALYTICS_JOBS.HEAVY_EXPORT) {
        const { default: AnalyticsFacadeService } = await import(
          '../services/analytics/AnalyticsFacadeService.js'
        );
        const service = new AnalyticsFacadeService();
        const result = await service.exportReport(
          job.data.category,
          job.data.format || 'csv',
          job.data.query || {},
          { actorId: job.data.actorId }
        );
        logger.info('Analytics heavy export done', {
          category: job.data.category,
          bytes: result.body?.length || 0,
        });
        return { ok: true, category: job.data.category };
      }

      if (
        job.name === ANALYTICS_JOBS.DAILY_DIGEST ||
        job.name === ANALYTICS_JOBS.WEEKLY_DIGEST ||
        job.name === ANALYTICS_JOBS.MONTHLY_DIGEST
      ) {
        return runDigestPlaceholder(job.data.period || job.name);
      }

      return { ignored: true };
    },
    { connection: getBullConnection() }
  );

  attachDeadLetterHandler(worker, QUEUE_NAMES.ANALYTICS);

  ensureAnalyticsScheduledJobs().catch(() => {});
  logger.info('Analytics BullMQ worker started');
  return worker;
}

export default {
  enqueueAnalyticsExport,
  ensureAnalyticsScheduledJobs,
  startAnalyticsWorker,
  ANALYTICS_JOBS,
};
