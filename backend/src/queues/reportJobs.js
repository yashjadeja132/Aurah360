import { Worker } from 'bullmq';
import { getBullConnection, enqueueJob, QUEUE_NAMES, ensureRepeatableJob } from './connection.js';
import { attachDeadLetterHandler } from './dlq.js';
import logger from '../libs/logger.js';

export const REPORT_JOBS = Object.freeze({
  GENERATE: 'report-generate',
  DAILY_SCHEDULED: 'daily-scheduled-reports',
  WEEKLY_SCHEDULED: 'weekly-scheduled-reports',
  MONTHLY_SCHEDULED: 'monthly-scheduled-reports',
});

/** Called from the reports request path — must not block the response. */
export async function enqueueReportGeneration(runId) {
  await enqueueJob(
    QUEUE_NAMES.REPORTS,
    REPORT_JOBS.GENERATE,
    { runId },
    {
      jobId: `report-run-${runId}`,
      removeOnComplete: 50,
      removeOnFail: 100,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
    }
  );
}

/**
 * 07:00 CLINIC time. A scheduled report covers "yesterday", and yesterday is only a settled
 * calendar day once the clinic's own midnight has passed — running at 07:00 UTC (12:30 IST) both
 * mailed the report mid-morning and cut the day off at 05:30 IST.
 */
export async function ensureScheduledReportJobs() {
  try {
    await ensureRepeatableJob(QUEUE_NAMES.REPORTS, REPORT_JOBS.DAILY_SCHEDULED, { frequency: 'DAILY' }, {
      pattern: '0 7 * * *',
      jobId: 'reports-daily-scheduled',
    });
    await ensureRepeatableJob(QUEUE_NAMES.REPORTS, REPORT_JOBS.WEEKLY_SCHEDULED, { frequency: 'WEEKLY' }, {
      pattern: '0 7 * * 1',
      jobId: 'reports-weekly-scheduled',
    });
    await ensureRepeatableJob(QUEUE_NAMES.REPORTS, REPORT_JOBS.MONTHLY_SCHEDULED, { frequency: 'MONTHLY' }, {
      pattern: '0 7 1 * *',
      jobId: 'reports-monthly-scheduled',
    });
    logger.info('Report scheduled jobs ensured');
  } catch (err) {
    logger.warn('Report scheduled jobs not ensured', { message: err.message });
  }
}

let worker = null;

export function startReportWorker() {
  if (worker) return worker;

  worker = new Worker(
    QUEUE_NAMES.REPORTS,
    async (job) => {
      const { default: ReportService } = await import('../services/ReportService.js');
      const service = new ReportService();

      if (job.name === REPORT_JOBS.GENERATE) {
        const result = await service.processReportRun(job.data.runId);
        logger.info('Report run processed', { runId: job.data.runId, ...result });
        return result;
      }

      if (
        job.name === REPORT_JOBS.DAILY_SCHEDULED ||
        job.name === REPORT_JOBS.WEEKLY_SCHEDULED ||
        job.name === REPORT_JOBS.MONTHLY_SCHEDULED
      ) {
        const result = await service.runDueScheduledReports();
        logger.info('Scheduled reports sweep', {
          job: job.name,
          processed: result.processed,
        });
        return result;
      }

      return { ignored: true };
    },
    { connection: getBullConnection() }
  );

  attachDeadLetterHandler(worker, QUEUE_NAMES.REPORTS);

  ensureScheduledReportJobs().catch(() => {});

  logger.info('Report BullMQ worker started');
  return worker;
}

export default {
  enqueueReportGeneration,
  ensureScheduledReportJobs,
  startReportWorker,
  REPORT_JOBS,
};
