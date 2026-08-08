import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import '../../src/config/env.js';

/**
 * TZ-001 — BullMQ repeat patterns must be evaluated on the CLINIC's clock.
 *
 * `repeat: { pattern: '0 9 * * *' }` with no `tz` is evaluated in the WORKER PROCESS's timezone.
 * The clinic is in Surat and the containers are UTC, so the 09:00 patient reminder fired at 14:30
 * IST, and the 02:00 loyalty-expiry sweep fired at 07:30 IST in the middle of morning clinic.
 *
 * The second half of this suite is the part that would otherwise have gone unnoticed: the old
 * `ensure*` guard was "does a repeatable job with this NAME exist? then stop", so on any
 * environment that had already booted, adding `tz` would have been a silent no-op forever. These
 * tests pin the re-registration behaviour, not just the presence of the option.
 */

const h = vi.hoisted(() => {
  /** name -> array of repeatable descriptors, mirroring BullMQ's getRepeatableJobs() shape. */
  const registry = new Map();
  return { registry };
});

vi.mock('bullmq', () => {
  class FakeQueue {
    constructor(name) {
      this.name = name;
      if (!h.registry.has(name)) h.registry.set(name, []);
    }

    get store() {
      return h.registry.get(this.name);
    }

    async getRepeatableJobs() {
      return this.store.map((j) => ({ ...j }));
    }

    async add(jobName, data, opts = {}) {
      if (!opts.repeat) return { id: '1', name: jobName };
      const { pattern, tz } = opts.repeat;
      this.store.push({
        // BullMQ derives the repeatable key from name + pattern + tz, which is exactly why a
        // changed tz creates a SECOND entry instead of replacing the first.
        key: `${jobName}:::${pattern}:${tz || ''}`,
        name: jobName,
        pattern,
        tz: tz ?? null,
        data,
      });
      return { id: '1', name: jobName };
    }

    async removeRepeatableByKey(key) {
      const arr = this.store;
      const i = arr.findIndex((j) => j.key === key);
      if (i >= 0) arr.splice(i, 1);
      return i >= 0;
    }
  }
  class FakeWorker {
    on() {
      return this;
    }

    async close() {}
  }
  return { Queue: FakeQueue, Worker: FakeWorker, QueueEvents: FakeWorker };
});

const { getQueue, QUEUE_NAMES, ensureRepeatableJob } = await import('../../src/queues/connection.js');
const { refreshOrgRuntime, resetOrgRuntime } = await import('../../src/config/orgRuntime.js');

const ORIGINAL_TZ = process.env.TZ;

/** Every schedule assertion is run on a host that is NOT the clinic — that is the failing case. */
async function underHostTz(tz, fn) {
  const prev = process.env.TZ;
  process.env.TZ = tz;
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.TZ;
    else process.env.TZ = prev;
  }
}

const repeatables = async (queueName) => getQueue(queueName).getRepeatableJobs();

beforeEach(() => {
  for (const arr of h.registry.values()) arr.length = 0;
  resetOrgRuntime();
  refreshOrgRuntime({ timezone: 'Asia/Kolkata' });
});

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

describe('TZ-001 repeatable jobs carry the clinic timezone', () => {
  it('registers a cron pattern with tz = the clinic timezone', async () => {
    await underHostTz('UTC', () =>
      ensureRepeatableJob(QUEUE_NAMES.CRM, 'demo-job', {}, { pattern: '0 9 * * *', jobId: 'demo' })
    );
    const jobs = await repeatables(QUEUE_NAMES.CRM);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].pattern).toBe('0 9 * * *');
    expect(jobs[0].tz).toBe('Asia/Kolkata');
  });

  it('follows the configured organization timezone rather than the host', async () => {
    resetOrgRuntime();
    refreshOrgRuntime({ timezone: 'America/New_York' });
    await underHostTz('UTC', () =>
      ensureRepeatableJob(QUEUE_NAMES.CRM, 'demo-job', {}, { pattern: '0 9 * * *', jobId: 'demo' })
    );
    const jobs = await repeatables(QUEUE_NAMES.CRM);
    expect(jobs[0].tz).toBe('America/New_York');
  });

  it('is idempotent — a second ensure does not duplicate the schedule', async () => {
    const opts = { pattern: '0 9 * * *', jobId: 'demo' };
    await ensureRepeatableJob(QUEUE_NAMES.CRM, 'demo-job', {}, opts);
    const second = await ensureRepeatableJob(QUEUE_NAMES.CRM, 'demo-job', {}, opts);
    expect(second.changed).toBe(false);
    expect(await repeatables(QUEUE_NAMES.CRM)).toHaveLength(1);
  });
});

describe('TZ-001 a changed timezone actually takes effect', () => {
  it('replaces a legacy tz-less entry instead of leaving it registered', async () => {
    // Simulate an environment that booted before this fix: same name, same pattern, no tz.
    await getQueue(QUEUE_NAMES.CRM).add('demo-job', {}, { repeat: { pattern: '0 9 * * *' } });
    expect((await repeatables(QUEUE_NAMES.CRM))[0].tz).toBeNull();

    const res = await ensureRepeatableJob(
      QUEUE_NAMES.CRM,
      'demo-job',
      {},
      { pattern: '0 9 * * *', jobId: 'demo' }
    );

    const jobs = await repeatables(QUEUE_NAMES.CRM);
    expect(res.changed).toBe(true);
    // Exactly one — not two. A leftover tz-less entry would fire the job a SECOND time each day.
    expect(jobs).toHaveLength(1);
    expect(jobs[0].tz).toBe('Asia/Kolkata');
  });

  it('re-registers when the org timezone changes under an already-registered job', async () => {
    await ensureRepeatableJob(QUEUE_NAMES.CRM, 'demo-job', {}, { pattern: '0 9 * * *', jobId: 'demo' });
    resetOrgRuntime();
    refreshOrgRuntime({ timezone: 'Asia/Dubai' });
    await ensureRepeatableJob(QUEUE_NAMES.CRM, 'demo-job', {}, { pattern: '0 9 * * *', jobId: 'demo' });

    const jobs = await repeatables(QUEUE_NAMES.CRM);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].tz).toBe('Asia/Dubai');
  });

  it('re-registers when the cron pattern itself changes', async () => {
    await ensureRepeatableJob(QUEUE_NAMES.CRM, 'demo-job', {}, { pattern: '0 9 * * *', jobId: 'demo' });
    await ensureRepeatableJob(QUEUE_NAMES.CRM, 'demo-job', {}, { pattern: '0 6 * * *', jobId: 'demo' });

    const jobs = await repeatables(QUEUE_NAMES.CRM);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].pattern).toBe('0 6 * * *');
  });
});

describe('TZ-001 every scheduled job in the app is clinic-timed', () => {
  /** [module path, ensure export, queue, expected [name, pattern] pairs] */
  const cases = [
    ['../../src/queues/notificationJobs.js', 'ensureBirthdayScanJob', QUEUE_NAMES.NOTIFICATIONS, [['daily-birthday-scan', '0 9 * * *']]],
    ['../../src/queues/crmJobs.js', 'ensureDailyFollowUpScan', QUEUE_NAMES.CRM, [['daily-follow-up-scan', '0 8 * * *']]],
    ['../../src/queues/missedFollowUpJobs.js', 'ensureMissedFollowUpScan', QUEUE_NAMES.CRM, [['missed-follow-up-scan', '0 9 * * *']]],
    ['../../src/queues/loyaltyBirthdayJobs.js', 'ensureLoyaltyBirthdayScan', QUEUE_NAMES.LOYALTY, [['loyalty-birthday-scan', '0 6 * * *']]],
    ['../../src/queues/loyaltyExpiryJobs.js', 'ensureLoyaltyExpiryJobs', QUEUE_NAMES.LOYALTY, [
      ['loyalty-expire-due-lots', '0 2 * * *'],
      ['loyalty-remind-expiring-soon', '0 8 * * *'],
    ]],
    ['../../src/queues/reportJobs.js', 'ensureScheduledReportJobs', QUEUE_NAMES.REPORTS, [
      ['daily-scheduled-reports', '0 7 * * *'],
    ]],
    ['../../src/queues/analyticsJobs.js', 'ensureAnalyticsScheduledJobs', QUEUE_NAMES.ANALYTICS, [
      ['analytics-daily-digest', '15 7 * * *'],
    ]],
  ];

  for (const [path, exportName, queueName, expected] of cases) {
    it(`${exportName} schedules in the clinic timezone on a UTC host`, async () => {
      const mod = await import(path);
      await underHostTz('UTC', () => mod[exportName]());
      const jobs = await repeatables(queueName);
      for (const [name, pattern] of expected) {
        const job = jobs.find((j) => j.name === name);
        expect(job, `${name} was not registered`).toBeTruthy();
        expect(job.pattern).toBe(pattern);
        expect(job.tz).toBe('Asia/Kolkata');
      }
    });
  }
});
