import { QUEUE_NAMES, ensureRepeatableJob } from './connection.js';
import logger from '../libs/logger.js';
import Patient from '../models/Patient.model.js';
import LoyaltyLedgerEntry from '../models/LoyaltyLedgerEntry.model.js';
import LoyaltyEarningEngineService from '../services/LoyaltyEarningEngineService.js';
import { LOYALTY_EARNING_EVENT } from '../enums/loyalty.js';

export const LOYALTY_BIRTHDAY_JOBS = Object.freeze({
  SCAN: 'loyalty-birthday-scan',
});

/** Repeat cadence — once daily, mirroring missedFollowUpJobs.js's ensureMissedFollowUpScan. */
const SCAN_REPEAT_PATTERN = '0 6 * * *'; // 06:00 daily, CLINIC-local — whose birthday it is is a
// clinic-calendar question, so on a UTC host this fired at 11:30 IST and could credit the wrong day.

/**
 * E9 BIRTHDAY_BONUS — finds patients whose birthday (month/day of dateOfBirth) is `now` and
 * that have not already received a BIRTHDAY_BONUS credit this calendar year, then resolves the
 * engine for each. Dedup is enforced here (not just left to idempotencyKey) so a missed/retried
 * run never double-credits within the same year.
 */
export async function scanForBirthdayBonuses({ now = new Date() } = {}) {
  const engine = new LoyaltyEarningEngineService();
  const results = { scanned: 0, credited: 0, skippedAlreadyCredited: 0, skippedNoRule: 0, errors: [] };

  const month = now.getMonth(); // 0-11
  const day = now.getDate();

  const candidates = await Patient.find({
    dateOfBirth: { $ne: null },
    deletedAt: null,
  })
    .select('primaryBranchId dateOfBirth')
    .lean();

  for (const patient of candidates) {
    const dob = new Date(patient.dateOfBirth);
    if (dob.getMonth() !== month || dob.getDate() !== day) continue;

    results.scanned += 1;

    try {
      // Dedup per calendar year via a stable idempotencyKey — belt-and-suspenders alongside
      // LoyaltyLedgerService.credit()'s own (patientId, idempotencyKey) unique index, so a
      // missed/retried scan run never double-credits the same patient within the same year.
      const idempotencyKey = `birthday-bonus:${patient._id}:${now.getFullYear()}`;
      const existingByKey = await LoyaltyLedgerEntry.exists({ patientId: patient._id, idempotencyKey });
      if (existingByKey) {
        results.skippedAlreadyCredited += 1;
        continue;
      }

      const created = await engine.resolveAndCredit(LOYALTY_EARNING_EVENT.BIRTHDAY_BONUS, {
        patientId: patient._id,
        branchId: patient.primaryBranchId,
        occurredAt: now,
        idempotencyKey,
      });
      if (created.length) {
        results.credited += 1;
      } else {
        results.skippedNoRule += 1;
      }
    } catch (err) {
      results.errors.push({ patientId: patient._id.toString(), message: err.message });
      logger.warn('Birthday bonus resolution failed', {
        patientId: patient._id.toString(),
        message: err.message,
      });
    }
  }

  return results;
}

/** Repeatable daily scan, registered once — mirrors missedFollowUpJobs.js's pattern. */
export async function ensureLoyaltyBirthdayScan() {
  try {
    await ensureRepeatableJob(
      QUEUE_NAMES.LOYALTY,
      LOYALTY_BIRTHDAY_JOBS.SCAN,
      { type: 'scan' },
      { pattern: SCAN_REPEAT_PATTERN, jobId: 'loyalty-birthday-scan' }
    );
    logger.info('Loyalty birthday scan scheduled', { pattern: SCAN_REPEAT_PATTERN });
  } catch (err) {
    logger.warn('Loyalty birthday scan not scheduled', { message: err.message });
  }
}

/** Registers onto the shared LOYALTY queue worker — see queues/composeWorker.js. */
export const loyaltyBirthdayHandlerModule = {
  jobNames: [LOYALTY_BIRTHDAY_JOBS.SCAN],
  ensure: ensureLoyaltyBirthdayScan,
  handle: async () => {
    const result = await scanForBirthdayBonuses();
    logger.info('Loyalty birthday scan job', result);
    return result;
  },
};

export default {
  scanForBirthdayBonuses,
  ensureLoyaltyBirthdayScan,
  loyaltyBirthdayHandlerModule,
  LOYALTY_BIRTHDAY_JOBS,
};
