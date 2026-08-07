import { Queue } from 'bullmq';
import logger from '../libs/logger.js';
import { workerLogger } from '../libs/logChannels.js';
import { getBullConnection, QUEUE_NAMES } from './connection.js';

export const DLQ_NAME = 'dead-letter';

let dlq;

export function getDeadLetterQueue() {
  if (!dlq) {
    dlq = new Queue(DLQ_NAME, {
      connection: getBullConnection(),
      defaultJobOptions: {
        removeOnComplete: 500,
        removeOnFail: false,
        attempts: 1,
      },
    });
  }
  return dlq;
}

/**
 * Move a failed job payload into the dead-letter queue for inspection.
 * Does not alter original domain job processors.
 */
export async function sendToDeadLetter({
  sourceQueue,
  jobName,
  jobId,
  data,
  failedReason,
  attemptsMade,
}) {
  try {
    const queue = getDeadLetterQueue();
    const job = await queue.add(
      'failed-job',
      {
        sourceQueue,
        jobName,
        originalJobId: jobId,
        data,
        failedReason,
        attemptsMade,
        failedAt: new Date().toISOString(),
      },
      { jobId: `dlq-${sourceQueue}-${jobId}-${Date.now()}` }
    );
    workerLogger.warn('Job moved to dead-letter queue', {
      sourceQueue,
      jobName,
      jobId,
      dlqJobId: job.id,
    });
    return job;
  } catch (err) {
    logger.error('Failed to enqueue dead-letter job', { message: err.message, sourceQueue, jobId });
    return null;
  }
}

/** Attach standard failed handler that DLQs after final attempt. */
export function attachDeadLetterHandler(worker, sourceQueue) {
  worker.on('failed', async (job, err) => {
    const maxAttempts = job?.opts?.attempts ?? 3;
    const attemptsMade = job?.attemptsMade ?? 0;
    workerLogger.warn('BullMQ job failed', {
      sourceQueue,
      jobName: job?.name,
      jobId: job?.id,
      attemptsMade,
      message: err?.message,
    });
    if (job && attemptsMade >= maxAttempts) {
      await sendToDeadLetter({
        sourceQueue,
        jobName: job.name,
        jobId: job.id,
        data: job.data,
        failedReason: err?.message,
        attemptsMade,
      });
    }
  });

  worker.on('error', (err) => {
    workerLogger.error('BullMQ worker error', { sourceQueue, message: err.message });
  });
}

export function listQueueNames() {
  return { ...QUEUE_NAMES, DEAD_LETTER: DLQ_NAME };
}

export default {
  getDeadLetterQueue,
  sendToDeadLetter,
  attachDeadLetterHandler,
  DLQ_NAME,
};
