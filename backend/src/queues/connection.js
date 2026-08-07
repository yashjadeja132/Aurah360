import { Queue } from 'bullmq';
import config from '../config/index.js';

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

export default { getQueue, QUEUE_NAMES, getBullConnection };
