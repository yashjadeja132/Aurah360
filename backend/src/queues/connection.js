import { Queue } from 'bullmq';
import config from '../config/index.js';
import logger from '../libs/logger.js';
import { clinicTimezone } from '../utils/date.util.js';

/**
 * Shared BullMQ connection options (uses Redis).
 */
export const getBullConnection = () => ({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
});

/**
 * Queue name registry — add domain queues as modules are built.
 */
export const QUEUE_NAMES = Object.freeze({
  NOTIFICATIONS: 'notifications',
  REPORTS: 'reports',
  ANALYTICS: 'analytics',
  FILES: 'files',
  CRM: 'crm',
  APPOINTMENT_REMINDERS: 'appointment-reminders',
  LOYALTY: 'loyalty',
  AI: 'ai',
});

const queues = new Map();

export const getQueue = (name) => {
  if (!queues.has(name)) {
    queues.set(
      name,
      new Queue(name, {
        connection: getBullConnection(),
        defaultJobOptions: {
          removeOnComplete: { count: 100, age: 24 * 3600 },
          removeOnFail: { count: 500, age: 7 * 24 * 3600 },
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      })
    );
  }
  return queues.get(name);
};

/**
 * How long any single enqueue may block before we give up on it.
 *
 * BullMQ requires ioredis `maxRetriesPerRequest: null` (see config/redis.js), which makes
 * ioredis buffer commands in its offline queue INDEFINITELY while Redis is unreachable —
 * so `queue.add()` never settles and never rejects. A `try/catch` around it therefore
 * cannot fail open: the await simply hangs, and any request that emits a notification
 * (appointment cancel, invoice finalize, …) hangs with it until the HTTP client gives up.
 * Bounding the wait converts "request hangs forever" into "job not queued, request
 * completes" — the same degradation server.js already accepts when Redis is absent.
 */
const ENQUEUE_TIMEOUT_MS = 2000;

/**
 * Enqueue a job without ever blocking the caller indefinitely. Returns the BullMQ job on
 * success and `null` when it was dropped (Redis down/slow) — so callers can read `job.id`
 * and still treat a falsy result as a non-fatal degradation rather than a request failure.
 *
 * The dropped job is NOT retried here: the primary write has already been committed by the
 * caller, and the queue is a delivery mechanism, not the source of truth. Missed dispatches
 * are recovered by the periodic sweeps in jobs/ that re-scan for undelivered records.
 */
export const enqueueJob = async (queueName, jobName, data, opts = {}) => {
  let timer;
  try {
    const queue = getQueue(queueName);
    const timeout = new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`enqueue timed out after ${ENQUEUE_TIMEOUT_MS}ms`)), ENQUEUE_TIMEOUT_MS);
    });
    return await Promise.race([queue.add(jobName, data, opts), timeout]);
  } catch (error) {
    logger.warn('Job not enqueued — continuing without it', {
      queue: queueName,
      job: jobName,
      message: error.message,
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/**
 * TZ-001 — register a repeatable job on the CLINIC's clock, and re-register it when that changes.
 *
 * WHY THE TZ: BullMQ evaluates a cron pattern in the worker process's timezone unless `repeat.tz`
 * says otherwise. The clinic is in Surat but the containers run UTC, so `'0 9 * * *'` — the daily
 * patient reminder — actually fired at 14:30 IST, and `'0 2 * * *'` (loyalty expiry, deliberately
 * scheduled for the dead of night) fired at 07:30 IST in the middle of the morning clinic.
 *
 * WHY THIS WRAPPER: every `ensure*` caller used to guard with "is a repeatable job with this NAME
 * already registered? then do nothing". That guard is name-only, so once a schedule exists in Redis
 * no change to its pattern or timezone can ever take effect — adding `tz` would have been a no-op
 * on every environment that had already booted once, and the fix would have looked applied while
 * changing nothing. So compare the stored `pattern`/`tz` too, and when they differ remove the stale
 * entry by key before adding the new one. Removal is required rather than a plain re-add: BullMQ
 * derives a repeatable's key from name+pattern+tz, so a changed tz produces a SECOND key and the
 * job would then fire twice a day, once on each schedule.
 */
export async function ensureRepeatableJob(queueName, jobName, data, { pattern, jobId, tz }) {
  const timezone = tz || clinicTimezone();
  const queue = getQueue(queueName);
  const existing = await queue.getRepeatableJobs();
  const mine = existing.filter((j) => j.name === jobName);

  const current = mine.find((j) => j.pattern === pattern && (j.tz || null) === timezone);
  // Anything registered under this name that is NOT the schedule we want is stale — drop it.
  const stale = mine.filter((j) => j !== current);
  for (const j of stale) {
    await queue.removeRepeatableByKey(j.key);
    logger.info('Removed stale repeatable schedule', {
      queue: queueName,
      job: jobName,
      wasPattern: j.pattern,
      wasTz: j.tz || '(host)',
    });
  }
  if (current) return { changed: false, pattern, tz: timezone };

  await queue.add(jobName, data, { repeat: { pattern, tz: timezone }, jobId });
  logger.info('Repeatable schedule registered', { queue: queueName, job: jobName, pattern, tz: timezone });
  return { changed: true, pattern, tz: timezone };
}

export default { getQueue, enqueueJob, QUEUE_NAMES, getBullConnection, ensureRepeatableJob };
