import { Worker } from 'bullmq';
import { getQueue, getBullConnection, QUEUE_NAMES } from './connection.js';
import { attachDeadLetterHandler } from './dlq.js';
import logger from '../libs/logger.js';

export const REPORT_JOBS = Object.freeze({
  GENERATE: 'report-generate',
  DAILY_SCHEDULED: 'daily-scheduled-reports',
  WEEKLY_SCHEDULED: 'weekly-scheduled-reports',
  MONTHLY_SCHEDULED: 'monthly-scheduled-reports',
});

export async function enqueueReportGeneration(runId) {
  try {
    const queue = getQueue(QUEUE_NAMES.REPORTS);
    await queue.add(
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
  } catch (err) {
    logger.warn('Report generation not enqueued (Redis?)', { message: err.message, runId });
  }
}

export async function ensureScheduledReportJobs() {
  try {
    const queue = getQueue(QUEUE_NAMES.REPORTS);
    const existing = await queue.getRepeatableJobs();
    const names = new Set(existing.map((j) => j.name));

    if (!names.has(REPORT_JOBS.DAILY_SCHEDULED)) {
      await queue.add(
        REPORT_JOBS.DAILY_SCHEDULED,
        { frequency: 'DAILY' },
        { repeat: { pattern: '0 7 * * *' }, jobId: 'reports-daily-scheduled' }
      );
    }
    if (!names.has(REPORT_JOBS.WEEKLY_SCHEDULED)) {
      await queue.add(
        REPORT_JOBS.WEEKLY_SCHEDULED,
        { frequency: 'WEEKLY' },
        { repeat: { pattern: '0 7 * * 1' }, jobId: 'reports-weekly-scheduled' }
      );
    }
    if (!names.has(REPORT_JOBS.MONTHLY_SCHEDULED)) {
      await queue.add(
        REPORT_JOBS.MONTHLY_SCHEDULED,
        { frequency: 'MONTHLY' },
        { repeat: { pattern: '0 7 1 * *' }, jobId: 'reports-monthly-scheduled' }
      );
    }
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
