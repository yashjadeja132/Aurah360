import { Worker } from 'bullmq';
import { getBullConnection, getQueue } from './connection.js';
import { attachDeadLetterHandler } from './dlq.js';
import logger from '../libs/logger.js';

/**
 * One BullMQ worker per QUEUE, composed from several job-handler modules.
 *
 * Why this exists: two modules used to each call `new Worker(QUEUE_NAMES.LOYALTY, ...)`, and two
 * more did the same for QUEUE_NAMES.CRM. BullMQ delivers a given job to exactly ONE consumer, so
 * whichever worker happened to pick it up would fall through its own `job.name` checks and return
 * `{ ignored: true }` — reporting SUCCESS while doing nothing. Roughly half of every scheduled
 * expiry, reminder, birthday and follow-up run vanished silently, non-deterministically. Nothing
 * failed, so nothing alerted: points quietly never expired and follow-ups quietly never went out.
 *
 * The fix is structural rather than a patch: a queue may have exactly one worker, and handler
 * modules register the job names they own. An unclaimed job is now a loud warning instead of a
 * silent success, and two modules claiming the same job name throws at startup rather than
 * resolving by luck at runtime.
 */
const workers = new Map();
/** queueName -> Set of job names that actually have a handler. Used by the startup guard below. */
const routesByQueue = new Map();

/**
 * @param {string} queueName
 * @param {Array<{ jobNames: string[], handle: (job) => Promise<any>, ensure?: () => Promise<any> }>} modules
 */
export function startComposedWorker(queueName, modules) {
  if (workers.has(queueName)) return workers.get(queueName);

  const routes = new Map();
  for (const mod of modules) {
    for (const jobName of mod.jobNames) {
      if (routes.has(jobName)) {
        // Two modules claiming one job name is exactly the ambiguity this file removes; failing at
        // startup is far cheaper than discovering it as intermittently-missing jobs in production.
        throw new Error(
          `Queue "${queueName}" has two handlers registered for job "${jobName}" — job names must be unique per queue`
        );
      }
      routes.set(jobName, mod.handle);
    }
  }

  const worker = new Worker(
    queueName,
    async (job) => {
      const handle = routes.get(job.name);
      if (!handle) {
        // Previously this returned { ignored: true } and the job was marked completed.
        logger.warn('Job has no registered handler on this queue — not processed', {
          queue: queueName,
          jobName: job.name,
          registered: [...routes.keys()],
        });
        return { unhandled: true, jobName: job.name };
      }
      return handle(job);
    },
    { connection: getBullConnection() }
  );

  attachDeadLetterHandler(worker, queueName);
  workers.set(queueName, worker);
  routesByQueue.set(queueName, new Set(routes.keys()));

  for (const mod of modules) {
    if (mod.ensure) mod.ensure().catch(() => {});
  }

  logger.info('Composed BullMQ worker started', {
    queue: queueName,
    jobNames: [...routes.keys()],
  });
  return worker;
}

/**
 * Startup guard: every repeatable job scheduled on the queue must have a registered handler.
 * A scheduled job with no consumer is the same silent failure wearing a different hat.
 */
export async function assertScheduledJobsAreHandled(queueName) {
  const registered = routesByQueue.get(queueName);
  if (!registered) return;
  try {
    const repeatables = await getQueue(queueName).getRepeatableJobs();
    const orphans = repeatables.map((j) => j.name).filter((n) => n && !registered.has(n));
    if (orphans.length) {
      logger.warn('Scheduled jobs have no handler on their queue — they will not run', {
        queue: queueName,
        orphans,
        registered: [...registered],
      });
    }
  } catch (err) {
    logger.warn('Could not verify scheduled jobs', { queue: queueName, message: err.message });
  }
}

export default { startComposedWorker, assertScheduledJobsAreHandled };
