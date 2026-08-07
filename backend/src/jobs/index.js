import { startTokenCleanupJob, stopTokenCleanupJob } from './tokenCleanup.job.js';
import logger from '../libs/logger.js';

/**
 * Background maintenance jobs (non-BullMQ timers).
 * Domain workers remain in queues/*.
 */
export const JOB_NAMES = Object.freeze({
  SEND_NOTIFICATION: 'send-notification',
  GENERATE_REPORT: 'generate-report',
  TOKEN_CLEANUP: 'token-cleanup',
});

export function startMaintenanceJobs() {
  try {
    startTokenCleanupJob();
  } catch (err) {
    logger.warn('Maintenance jobs failed to start', { message: err.message });
  }
}

export function stopMaintenanceJobs() {
  stopTokenCleanupJob();
}

export default { JOB_NAMES, startMaintenanceJobs, stopMaintenanceJobs };
