import { QUEUE_NAMES, ensureRepeatableJob } from './connection.js';
import logger from '../libs/logger.js';
import Appointment from '../models/Appointment.model.js';
import Invoice from '../models/Invoice.model.js';
import LoyaltyLedgerEntry from '../models/LoyaltyLedgerEntry.model.js';
import LoyaltyTier, { PatientTierState } from '../models/LoyaltyTier.model.js';
import LoyaltyLedgerService from '../services/LoyaltyLedgerService.js';
import { eventBus } from '../events/eventBus.js';
import { LOYALTY_EVENTS, LOYALTY_ENTRY_TYPE } from '../enums/loyalty.js';
import { APPOINTMENT_STATUS } from '../enums/appointment.js';
import { PAYMENT_STATUS } from '../enums/billing.js';

export const LOYALTY_TIER_JOBS = Object.freeze({
  RECALCULATE: 'loyalty-tier-recalculate',
});

/** Repeat cadence — once daily, mirroring loyaltyExpiryJobs.js/loyaltyBirthdayJobs.js. */
const RECALCULATE_REPEAT_PATTERN = '0 3 * * *'; // 03:00 CLINIC-local — after expiry, before wake-up

const ROLLING_WINDOW_DAYS = 365;

/**
 * LOY-012 — tier qualification is explicitly a TRAILING 12-MONTH ROLLING WINDOW (PRD §4:
 * "12-month rolling points earned OR visits count OR spend"), never a lifetime total. Recomputes
 * each of the three rolling counters from source records (never trusts a stale cache), then
 * resolves the patient's tier as the highest-rank active tier whose OWN qualificationBasis
 * counter clears its OWN threshold — each tier's basis is independent, matching the schema
 * (LoyaltyTier.qualificationBasis is per-tier, not program-wide).
 */
async function computeRollingCounters(patientId, since) {
  const [creditAgg, visitsCount, invoiceAgg] = await Promise.all([
    LoyaltyLedgerEntry.aggregate([
      {
        $match: {
          patientId,
          entryType: { $in: [LOYALTY_ENTRY_TYPE.CREDIT, LOYALTY_ENTRY_TYPE.MANUAL_CREDIT] },
          createdAt: { $gte: since },
        },
      },
      { $group: { _id: null, total: { $sum: '$points' } } },
    ]),
    Appointment.countDocuments({
      patientId,
      status: APPOINTMENT_STATUS.COMPLETED,
      appointmentDate: { $gte: since },
    }),
    Invoice.aggregate([
      {
        $match: {
          patientId,
          paymentStatus: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_PAID] },
          updatedAt: { $gte: since },
        },
      },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } },
    ]),
  ]);

  return {
    rollingPointsEarned: creditAgg[0]?.total || 0,
    rollingVisitsCount: visitsCount || 0,
    rollingSpend: invoiceAgg[0]?.total || 0,
  };
}

const BASIS_COUNTER = Object.freeze({
  POINTS_EARNED_ROLLING_12M: 'rollingPointsEarned',
  VISITS_COUNT_ROLLING_12M: 'rollingVisitsCount',
  SPEND_ROLLING_12M: 'rollingSpend',
});

/** Highest-rank active tier whose threshold the matching rolling counter clears, or null. */
function resolveQualifyingTier(tiers, counters) {
  const qualifying = tiers
    .filter((t) => t.isActive)
    .filter((t) => {
      const counterKey = BASIS_COUNTER[t.qualificationBasis];
      return counterKey && (counters[counterKey] || 0) >= t.threshold;
    })
    .sort((a, b) => b.rank - a.rank);
  return qualifying[0] || null;
}

/**
 * LOY-012 — recomputes rolling counters + qualifying tier for one patient and persists
 * PatientTierState. Upgrades apply immediately; downgrades are deferred behind the tier's own
 * `downgradeGracePeriodDays` (PRD §4 "Downgrade rule: rolling-window re-evaluation, grace period
 * configurable") — a patient dipping below threshold gets a warning window before losing benefits,
 * not an instant drop the moment one rolling day falls out of the window.
 */
export async function recalculateTierForPatient(patientId, { tiers = null, now = new Date() } = {}) {
  const activeTiers = tiers || (await LoyaltyTier.find({ isActive: true }).lean());
  if (!activeTiers.length) return { changed: false };

  const since = new Date(now);
  since.setDate(since.getDate() - ROLLING_WINDOW_DAYS);

  const counters = await computeRollingCounters(patientId, since);
  const qualifyingTier = resolveQualifyingTier(activeTiers, counters);

  let state = await PatientTierState.findOne({ patientId });
  if (!state) {
    state = new PatientTierState({ patientId });
  }

  const currentTier = state.currentTierId
    ? activeTiers.find((t) => String(t._id) === String(state.currentTierId))
    : null;
  const currentRank = currentTier?.rank ?? -1;
  const qualifyingRank = qualifyingTier?.rank ?? -1;

  state.rollingPointsEarned = counters.rollingPointsEarned;
  state.rollingVisitsCount = counters.rollingVisitsCount;
  state.rollingSpend = counters.rollingSpend;
  state.recalculatedAt = now;

  let changed = false;
  let newTierId = state.currentTierId;

  if (qualifyingRank > currentRank) {
    // Upgrade — applies immediately, clears any pending downgrade warning.
    newTierId = qualifyingTier?._id || null;
    state.tierSince = now;
    state.downgradeWarningAt = null;
    changed = String(newTierId || '') !== String(state.currentTierId || '');
    state.currentTierId = newTierId;
  } else if (qualifyingRank < currentRank) {
    // Below current tier's requirement — start (or continue) the grace window instead of
    // dropping immediately.
    const graceDays = currentTier?.downgradeGracePeriodDays ?? 30;
    if (!state.downgradeWarningAt) {
      state.downgradeWarningAt = now;
    } else {
      const graceElapsedMs = now - state.downgradeWarningAt;
      if (graceElapsedMs >= graceDays * 24 * 60 * 60 * 1000) {
        newTierId = qualifyingTier?._id || null;
        changed = String(newTierId || '') !== String(state.currentTierId || '');
        state.currentTierId = newTierId;
        state.tierSince = now;
        state.downgradeWarningAt = null;
      }
    }
  } else {
    // Still qualifies for the current tier — clear any stale downgrade warning.
    state.downgradeWarningAt = null;
  }

  await state.save();

  if (changed) {
    eventBus.emitDomain(LOYALTY_EVENTS.TIER_CHANGED, {
      patientId: patientId.toString(),
      fromTierId: currentTier?._id?.toString() || null,
      toTierId: newTierId?.toString?.() || null,
      counters,
    });
  }

  return { changed, tierId: newTierId?.toString?.() || null, counters };
}

/**
 * LOY-012 daily scan — a no-op (fast exit) unless tiers are enabled AND at least one tier exists,
 * mirroring the engine's own tiersEnabled gate (LoyaltyEarningEngineService.applyTierMultiplier).
 * Scoped to patients with any loyalty ledger activity, since a patient who has never earned a
 * point cannot qualify for any tier and recomputing them daily would be pure waste.
 */
export async function recalculateAllTiers({ ledgerService = null, now = new Date() } = {}) {
  const service = ledgerService || new LoyaltyLedgerService();
  const results = { scanned: 0, changed: 0, errors: [] };

  const settings = await service.getSettings();
  if (!settings?.tiersEnabled) return results;

  const tiers = await LoyaltyTier.find({ isActive: true }).lean();
  if (!tiers.length) return results;

  const patientIds = await LoyaltyLedgerEntry.distinct('patientId');
  results.scanned = patientIds.length;

  for (const patientId of patientIds) {
    try {
      const outcome = await recalculateTierForPatient(patientId, { tiers, now });
      if (outcome.changed) results.changed += 1;
    } catch (err) {
      results.errors.push({ patientId: patientId?.toString?.(), message: err.message });
      logger.warn('Loyalty tier recalculation failed', {
        patientId: patientId?.toString?.(),
        message: err.message,
      });
    }
  }

  return results;
}

export async function ensureLoyaltyTierRecalculation() {
  try {
    await ensureRepeatableJob(
      QUEUE_NAMES.LOYALTY,
      LOYALTY_TIER_JOBS.RECALCULATE,
      { type: 'recalculate-tiers' },
      { pattern: RECALCULATE_REPEAT_PATTERN, jobId: 'loyalty-tier-recalculate' }
    );
    logger.info('Loyalty tier recalculation scheduled', { pattern: RECALCULATE_REPEAT_PATTERN });
  } catch (err) {
    logger.warn('Loyalty tier recalculation not scheduled', { message: err.message });
  }
}

/** Registers onto the shared LOYALTY queue worker — see queues/composeWorker.js. */
export const loyaltyTierHandlerModule = {
  jobNames: [LOYALTY_TIER_JOBS.RECALCULATE],
  ensure: ensureLoyaltyTierRecalculation,
  handle: async () => {
    const result = await recalculateAllTiers();
    logger.info('Loyalty tier recalculation job', result);
    return result;
  },
};

export default {
  recalculateTierForPatient,
  recalculateAllTiers,
  ensureLoyaltyTierRecalculation,
  loyaltyTierHandlerModule,
  LOYALTY_TIER_JOBS,
};
