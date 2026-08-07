import { Worker } from 'bullmq';
import { getQueue, getBullConnection, QUEUE_NAMES } from './connection.js';
import { attachDeadLetterHandler } from './dlq.js';
import logger from '../libs/logger.js';
import LoyaltyLedgerService from '../services/LoyaltyLedgerService.js';
import { LOYALTY_EVENTS } from '../enums/loyalty.js';
import { eventBus } from '../events/eventBus.js';

export const LOYALTY_EXPIRY_JOBS = Object.freeze({
  EXPIRE_DUE_LOTS: 'loyalty-expire-due-lots',
  REMIND_EXPIRING_SOON: 'loyalty-remind-expiring-soon',
});

/** Repeat cadence — once daily, mirroring missedFollowUpJobs.js's ensureMissedFollowUpScan. */
const EXPIRE_REPEAT_PATTERN = '0 2 * * *'; // 02:00 daily — expire lots due today before patients wake up
const REMIND_REPEAT_PATTERN = '0 8 * * *'; // 08:00 daily — reminders sent as a morning digest

/**
 * LOY expiry job — the only caller (besides tests) of LoyaltyLedgerService#expireLot. Finds
 * every open CREDIT lot whose earnLotExpiryDate is due today (findLotsExpiringWithin(0)) and
 * expires it via the ledger service, which is the sole gate for the mutation, the cache update,
 * and the LoyaltyPointsExpired domain event.
 */
export async function expireDueLots({ ledgerService = null } = {}) {
  const service = ledgerService || new LoyaltyLedgerService();
  const results = { scanned: 0, expired: 0, errors: [] };

  const dueLots = await service.findLotsExpiringWithin(0);
  results.scanned = dueLots.length;

  for (const lot of dueLots) {
    try {
      await service.expireLot({
        branchId: lot.branchId,
        patientId: lot.patientId,
        lotEntryId: lot._id,
        points: lot.remaining,
        organizationId: lot.organizationId || null,
      });
      results.expired += 1;
    } catch (err) {
      results.errors.push({ lotEntryId: lot._id?.toString?.(), message: err.message });
      logger.warn('Loyalty lot expiry failed', {
        lotEntryId: lot._id?.toString?.(),
        patientId: lot.patientId?.toString?.(),
        message: err.message,
      });
    }
  }

  return results;
}

/**
 * LOY expiry-reminder job — emits LOYALTY_EVENTS.POINTS_EXPIRING_SOON per patient/lot for every
 * lot due within the configured `LoyaltyProgramSettings.expiryReminderDaysBefore` windows
 * (defaults to [30, 7] days — see LoyaltyProgramSettings.model.js). This job only emits the
 * domain event; it does not send notifications itself — NotificationService's generic domain-
 * event consumer (backend/src/notifications/eventSubscriptions.js's SUBSCRIBED_EVENTS list,
 * wired the same way FollowUpDue/InvoiceCreated etc. are) picks up 'LoyaltyPointsExpiringSoon'
 * and dispatches whatever notification template is configured for it — no new template code
 * is built here.
 */
export async function remindExpiringSoon({ ledgerService = null, reminderDaysBefore = null } = {}) {
  const service = ledgerService || new LoyaltyLedgerService();
  const settings = await service.getSettings();
  const windows =
    reminderDaysBefore ||
    (Array.isArray(settings?.expiryReminderDaysBefore) && settings.expiryReminderDaysBefore.length
      ? settings.expiryReminderDaysBefore
      : [30, 7]);

  const results = { windowsProcessed: windows, remindersEmitted: 0 };
  const seen = new Set();

  for (const withinDays of windows) {
    const lots = await service.findLotsExpiringWithin(withinDays);
    for (const lot of lots) {
      const dedupeKey = `${lot._id?.toString?.()}:${withinDays}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      eventBus.emitDomain(LOYALTY_EVENTS.POINTS_EXPIRING_SOON, {
        patientId: lot.patientId?.toString?.() || lot.patientId,
        branchId: lot.branchId?.toString?.() || lot.branchId,
        lotEntryId: lot._id?.toString?.(),
        points: lot.remaining,
        earnLotExpiryDate: lot.earnLotExpiryDate,
        daysRemaining: withinDays,
      });
      results.remindersEmitted += 1;
    }
  }

  return results;
}

/** Registers both repeatable jobs once — mirrors missedFollowUpJobs.js's ensureMissedFollowUpScan. */
export async function ensureLoyaltyExpiryJobs() {
  try {
    const queue = getQueue(QUEUE_NAMES.LOYALTY);
    const existing = await queue.getRepeatableJobs();

    if (!existing.some((j) => j.name === LOYALTY_EXPIRY_JOBS.EXPIRE_DUE_LOTS)) {
      await queue.add(
        LOYALTY_EXPIRY_JOBS.EXPIRE_DUE_LOTS,
        { type: 'expire' },
        { repeat: { pattern: EXPIRE_REPEAT_PATTERN }, jobId: 'loyalty-expire-due-lots' }
      );
    }

    if (!existing.some((j) => j.name === LOYALTY_EXPIRY_JOBS.REMIND_EXPIRING_SOON)) {
      await queue.add(
        LOYALTY_EXPIRY_JOBS.REMIND_EXPIRING_SOON,
        { type: 'remind' },
        { repeat: { pattern: REMIND_REPEAT_PATTERN }, jobId: 'loyalty-remind-expiring-soon' }
      );
    }

    logger.info('Loyalty expiry jobs scheduled', {
      expirePattern: EXPIRE_REPEAT_PATTERN,
      remindPattern: REMIND_REPEAT_PATTERN,
    });
  } catch (err) {
    logger.warn('Loyalty expiry jobs not scheduled', { message: err.message });
  }
}

let worker = null;

export function startLoyaltyExpiryWorker() {
  if (worker) return worker;

  worker = new Worker(
    QUEUE_NAMES.LOYALTY,
    async (job) => {
      if (job.name === LOYALTY_EXPIRY_JOBS.EXPIRE_DUE_LOTS) {
        const result = await expireDueLots();
        logger.info('Loyalty expiry job', result);
        return result;
      }
      if (job.name === LOYALTY_EXPIRY_JOBS.REMIND_EXPIRING_SOON) {
        const result = await remindExpiringSoon();
        logger.info('Loyalty expiry reminder job', result);
        return result;
      }
      return { ignored: true };
    },
    { connection: getBullConnection() }
  );

  attachDeadLetterHandler(worker, QUEUE_NAMES.LOYALTY);

  ensureLoyaltyExpiryJobs().catch(() => {});

  logger.info('Loyalty expiry BullMQ worker started');
  return worker;
}

export default {
  expireDueLots,
  remindExpiringSoon,
  ensureLoyaltyExpiryJobs,
  startLoyaltyExpiryWorker,
  LOYALTY_EXPIRY_JOBS,
};
