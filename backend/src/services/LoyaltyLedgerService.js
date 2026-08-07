import ApiError from '../libs/ApiError.js';
import AuditService from './AuditService.js';
import { eventBus } from '../events/eventBus.js';
import LoyaltyLedgerEntry from '../models/LoyaltyLedgerEntry.model.js';
import LoyaltyBalanceCache from '../models/LoyaltyBalanceCache.model.js';
import LoyaltyProgramSettings from '../models/LoyaltyProgramSettings.model.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import {
  LOYALTY_ENTRY_TYPE,
  LOYALTY_CREDIT_ENTRY_TYPES,
  LOYALTY_EVENTS,
} from '../enums/loyalty.js';

/**
 * LOY-003/LOY-005/LOY-006 — the single append-only entry point for every loyalty-points
 * mutation. Every other loyalty component (earning engine, redemption, clawback, manual
 * adjustments, expiry job) MUST go through this service rather than writing
 * LoyaltyLedgerEntry/LoyaltyBalanceCache directly — mirrors InventoryService's role as the
 * sole gate for StockTransaction (backend/src/services/InventoryService.js).
 *
 * Design invariants:
 *  - LoyaltyLedgerEntry is create-only. A mistake is corrected with a counter-entry, never
 *    an update/delete.
 *  - LoyaltyBalanceCache is a REBUILDABLE read-optimization, derived from the ledger — never
 *    trusted as the source of truth for anything but fast reads. #applyToCache keeps it in
 *    sync on every write; rebuildCache() can always recompute it from scratch.
 *  - FIFO consumption: DEBIT_REDEEM/DEBIT_EXPIRY/DEBIT_CLAWBACK always consume the oldest
 *    still-open CREDIT lots first (earnLotExpiryDate ascending, nulls/never-expiring last),
 *    and each resulting debit entry records which CREDIT entry it consumed via
 *    consumesEntryId so reversal-restoration can trace back to the exact lot.
 *  - Idempotency: any caller that might retry (BullMQ job, webhook) passes idempotencyKey;
 *    a duplicate (patientId, idempotencyKey) pair is rejected by the unique sparse index and
 *    surfaced here as a benign no-op rather than a 500.
 */
class LoyaltyLedgerService {
  constructor() {
    this.auditService = new AuditService();
  }

  async #getActiveSettings(atDate = new Date()) {
    const settings = await LoyaltyProgramSettings.findOne({ effectiveFrom: { $lte: atDate } })
      .sort({ effectiveFrom: -1 })
      .lean();
    return settings || null;
  }

  /** Public helper — other loyalty services (engine, redemption) gate on this before writing. */
  async assertProgramEnabled() {
    const settings = await this.#getActiveSettings();
    if (!settings?.programEnabled) {
      throw ApiError.forbidden('Loyalty program is not enabled.');
    }
    return settings;
  }

  async getSettings(atDate) {
    return this.#getActiveSettings(atDate);
  }

  #computeExpiryDate(settings, fromDate = new Date()) {
    if (!settings?.pointsExpiryMonths) return null;
    const expiry = new Date(fromDate);
    expiry.setMonth(expiry.getMonth() + settings.pointsExpiryMonths);
    return expiry;
  }

  async #getOrCreateCache(patientId, session) {
    let cache = await LoyaltyBalanceCache.findOne({ patientId }).session(session || null);
    if (!cache) {
      cache = new LoyaltyBalanceCache({ patientId, currentBalance: 0, redeemableBalance: 0 });
      await cache.save({ session });
    }
    return cache;
  }

  /** Refreshes the "next expiring lot" hint on the cache — best-effort, not transactionally
   *  critical (it's a UX hint, not a balance figure). */
  async #refreshNextExpiringLot(patientId, session) {
    const openCredits = await this.#openCreditLots(patientId, session);
    const next = openCredits.find((lot) => lot.remaining > 0 && lot.earnLotExpiryDate);
    return {
      nextExpiringLotPoints: next ? next.remaining : null,
      nextExpiringLotDate: next ? next.earnLotExpiryDate : null,
    };
  }

  /** Every still-open CREDIT lot for a patient, FIFO-ordered (soonest-expiring/oldest first,
   *  never-expiring lots last), each annotated with how many points remain unconsumed. */
  async #openCreditLots(patientId, session) {
    const credits = await LoyaltyLedgerEntry.find({
      patientId,
      entryType: { $in: LOYALTY_CREDIT_ENTRY_TYPES },
    })
      .sort({ createdAt: 1 })
      .session(session || null)
      .lean();

    if (!credits.length) return [];

    const consumed = await LoyaltyLedgerEntry.aggregate([
      { $match: { patientId: credits[0].patientId, consumesEntryId: { $ne: null } } },
      { $group: { _id: '$consumesEntryId', total: { $sum: '$points' } } },
    ]).session(session || null);
    const consumedMap = new Map(consumed.map((c) => [c._id.toString(), c.total]));

    return credits
      .map((c) => ({
        ...c,
        remaining: c.points - (consumedMap.get(c._id.toString()) || 0),
      }))
      .filter((c) => c.remaining > 0)
      .sort((a, b) => {
        const aExp = a.earnLotExpiryDate ? new Date(a.earnLotExpiryDate).getTime() : Infinity;
        const bExp = b.earnLotExpiryDate ? new Date(b.earnLotExpiryDate).getTime() : Infinity;
        if (aExp !== bExp) return aExp - bExp;
        return new Date(a.createdAt) - new Date(b.createdAt);
      });
  }

  /** Derives current/redeemable/lifetime balances straight from the ledger — the ground truth
   *  used by rebuildCache() and available for reconciliation/audits. */
  async computeBalanceFromLedger(patientId) {
    const rows = await LoyaltyLedgerEntry.aggregate([
      { $match: { patientId } },
      {
        $group: {
          _id: '$entryType',
          total: { $sum: '$points' },
        },
      },
    ]);
    const byType = Object.fromEntries(rows.map((r) => [r._id, r.total]));
    const credit = (t) => byType[t] || 0;

    const lifetimeEarned = credit(LOYALTY_ENTRY_TYPE.CREDIT) + credit(LOYALTY_ENTRY_TYPE.MANUAL_CREDIT);
    const lifetimeRedeemed = credit(LOYALTY_ENTRY_TYPE.DEBIT_REDEEM);
    const lifetimeExpired = credit(LOYALTY_ENTRY_TYPE.DEBIT_EXPIRY);

    const totalCredits =
      credit(LOYALTY_ENTRY_TYPE.CREDIT) +
      credit(LOYALTY_ENTRY_TYPE.CREDIT_REVERSAL) +
      credit(LOYALTY_ENTRY_TYPE.MANUAL_CREDIT);
    const totalDebits =
      credit(LOYALTY_ENTRY_TYPE.DEBIT_REDEEM) +
      credit(LOYALTY_ENTRY_TYPE.DEBIT_EXPIRY) +
      credit(LOYALTY_ENTRY_TYPE.DEBIT_CLAWBACK) +
      credit(LOYALTY_ENTRY_TYPE.MANUAL_DEBIT);

    const currentBalance = Math.max(0, totalCredits - totalDebits);
    return { currentBalance, lifetimeEarned, lifetimeRedeemed, lifetimeExpired };
  }

  /** Rebuilds LoyaltyBalanceCache for one patient (or call in a loop for all patients) purely
   *  from the ledger — the documented repair path if the cache ever drifts. */
  async rebuildCache(patientId) {
    const derived = await this.computeBalanceFromLedger(patientId);
    const { nextExpiringLotPoints, nextExpiringLotDate } = await this.#refreshNextExpiringLot(patientId);
    const lastEntry = await LoyaltyLedgerEntry.findOne({ patientId }).sort({ createdAt: -1 }).lean();

    const cache = await LoyaltyBalanceCache.findOneAndUpdate(
      { patientId },
      {
        $set: {
          currentBalance: derived.currentBalance,
          redeemableBalance: derived.currentBalance, // no separate hold concept beyond clawback-pending
          lifetimeEarned: derived.lifetimeEarned,
          lifetimeRedeemed: derived.lifetimeRedeemed,
          lifetimeExpired: derived.lifetimeExpired,
          nextExpiringLotPoints,
          nextExpiringLotDate,
          lastLedgerEntryId: lastEntry?._id || null,
          recalculatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
    return cache.toSafeObject();
  }

  async getBalance(patientId) {
    const cache = await this.#getOrCreateCache(patientId);
    return cache.toSafeObject();
  }

  /**
   * Writes a single CREDIT (or MANUAL_CREDIT/CREDIT_REVERSAL) ledger entry and keeps the
   * balance cache in sync. Used directly for manual adjustments/reversals; the earning-rule
   * engine (LoyaltyEarningEngineService, built separately) calls this per resolved rule.
   */
  async credit({
    branchId,
    patientId,
    points,
    entryType = LOYALTY_ENTRY_TYPE.CREDIT,
    ruleCode = null,
    ruleVersionId = null,
    sourceRefType = null,
    sourceRefId = null,
    reasonCategory = null,
    note = null,
    approvedBy = null,
    idempotencyKey = null,
    createdBy = null,
    organizationId = null,
    actorReq = null,
  }) {
    if (!LOYALTY_CREDIT_ENTRY_TYPES.includes(entryType)) {
      throw ApiError.badRequest(`entryType must be one of: ${LOYALTY_CREDIT_ENTRY_TYPES.join(', ')}`);
    }
    if (!Number.isFinite(points) || points <= 0) {
      throw ApiError.badRequest('points must be a positive integer.');
    }
    const roundedPoints = Math.floor(points);

    const settings = await this.#getActiveSettings();
    const earnLotExpiryDate = this.#computeExpiryDate(settings);

    let entry;
    try {
      entry = await LoyaltyLedgerEntry.create({
        organizationId,
        branchId,
        patientId,
        entryType,
        points: roundedPoints,
        ruleCode,
        ruleVersionId,
        sourceRefType,
        sourceRefId,
        earnLotExpiryDate,
        reasonCategory,
        note,
        approvedBy,
        idempotencyKey,
        createdBy,
      });
    } catch (error) {
      if (error?.code === 11000 && idempotencyKey) {
        // Duplicate delivery (job/webhook retry) — return the existing entry, not an error.
        const existing = await LoyaltyLedgerEntry.findOne({ patientId, idempotencyKey });
        if (existing) return existing.toSafeObject({ duplicate: true });
      }
      throw error;
    }

    await this.#applyCreditToCache(patientId, roundedPoints, entry, settings);

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_POINTS_CREDITED, {
      actorId: createdBy,
      req: actorReq,
      branchId,
      resourceType: 'LoyaltyLedgerEntry',
      resourceId: entry._id,
      metadata: { entryType, points: roundedPoints, ruleCode, sourceRefType, sourceRefId },
    });

    eventBus.emitDomain(LOYALTY_EVENTS.POINTS_EARNED, {
      patientId: patientId.toString(),
      branchId: branchId?.toString?.() || branchId,
      points: roundedPoints,
      entryType,
      ruleCode,
      earnLotExpiryDate,
    });

    return entry.toSafeObject();
  }

  async #applyCreditToCache(patientId, points, entry, settings) {
    const cache = await this.#getOrCreateCache(patientId);
    cache.currentBalance += points;
    cache.redeemableBalance += points;
    if (entry.entryType !== LOYALTY_ENTRY_TYPE.CREDIT_REVERSAL) {
      cache.lifetimeEarned += points;
    }
    if (!cache.nextExpiringLotDate || (entry.earnLotExpiryDate && entry.earnLotExpiryDate < cache.nextExpiringLotDate)) {
      cache.nextExpiringLotDate = entry.earnLotExpiryDate;
      cache.nextExpiringLotPoints = points;
    }
    cache.lastLedgerEntryId = entry._id;
    cache.recalculatedAt = new Date();
    await cache.save();
    return cache;
  }

  /**
   * FIFO-consumes `points` worth of open CREDIT lots and writes one debit entry per lot
   * consumed (so every debit's consumesEntryId traces to exactly one credit lot). Returns the
   * list of debit entries created. Shared by redeem/expire/clawback — they only differ in
   * entryType and the extra fields attached to each debit row.
   */
  async #debitFifo({
    patientId,
    branchId,
    points,
    entryType,
    extraFields = {},
    createdBy = null,
    organizationId = null,
  }) {
    const lots = await this.#openCreditLots(patientId);
    const available = lots.reduce((sum, l) => sum + l.remaining, 0);
    if (available < points) {
      throw ApiError.badRequest(
        `Insufficient loyalty balance: requested ${points}, available ${available}.`
      );
    }

    let remainingToDebit = points;
    const debitEntries = [];
    for (const lot of lots) {
      if (remainingToDebit <= 0) break;
      const take = Math.min(lot.remaining, remainingToDebit);
      const debit = await LoyaltyLedgerEntry.create({
        organizationId,
        branchId,
        patientId,
        entryType,
        points: take,
        consumesEntryId: lot._id,
        createdBy,
        ...extraFields,
      });
      debitEntries.push(debit);
      remainingToDebit -= take;
    }
    return debitEntries;
  }

  /**
   * LOY-005 — redeem points as a discount line item at billing. Caller (BillingService) is
   * responsible for composing this with — not bypassing — the existing discount-approval
   * threshold logic; this method only concerns itself with the points side of the ledger.
   */
  async redeem({
    branchId,
    patientId,
    points,
    invoiceId,
    redeemedValueInr,
    createdBy = null,
    organizationId = null,
    actorReq = null,
  }) {
    const settings = await this.assertProgramEnabled();
    if (!Number.isFinite(points) || points <= 0) {
      throw ApiError.badRequest('points must be a positive integer.');
    }
    if (points < settings.minimumPointsToRedeem) {
      throw ApiError.badRequest(
        `A minimum of ${settings.minimumPointsToRedeem} points is required to redeem.`
      );
    }
    if (points % settings.redemptionStepPoints !== 0) {
      throw ApiError.badRequest(`Points must be redeemed in steps of ${settings.redemptionStepPoints}.`);
    }

    const debitEntries = await this.#debitFifo({
      patientId,
      branchId,
      points,
      entryType: LOYALTY_ENTRY_TYPE.DEBIT_REDEEM,
      extraFields: { sourceRefType: 'INVOICE', sourceRefId: invoiceId, redeemedValueInr, conversionRateVersion: settings._id },
      createdBy,
      organizationId,
    });

    const cache = await this.#getOrCreateCache(patientId);
    cache.currentBalance = Math.max(0, cache.currentBalance - points);
    cache.redeemableBalance = Math.max(0, cache.redeemableBalance - points);
    cache.lifetimeRedeemed += points;
    cache.lastLedgerEntryId = debitEntries[debitEntries.length - 1]?._id || cache.lastLedgerEntryId;
    cache.recalculatedAt = new Date();
    await cache.save();

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_POINTS_REDEEMED, {
      actorId: createdBy,
      req: actorReq,
      branchId,
      resourceType: 'Invoice',
      resourceId: invoiceId,
      metadata: { points, redeemedValueInr, entriesCreated: debitEntries.length },
    });

    eventBus.emitDomain(LOYALTY_EVENTS.POINTS_REDEEMED, {
      patientId: patientId.toString(),
      points,
      redeemedValueInr,
      invoiceId: invoiceId?.toString?.() || invoiceId,
    });

    return debitEntries.map((e) => e.toSafeObject());
  }

  /**
   * LOY-006 — reverses points earned from a now-refunded/voided source (e.g. a session or
   * invoice that generated CREDIT entries is reversed). If the patient no longer has enough
   * balance to claw back (already redeemed elsewhere), the shortfall is recorded as a
   * PENDING_INSUFFICIENT_BALANCE clawback rather than pushing the balance negative or
   * silently under-clawing — see LOYALTY_CLAWBACK_STATUS.
   */
  async clawback({
    branchId,
    patientId,
    points,
    sourceRefType,
    sourceRefId,
    reasonNote = null,
    createdBy = null,
    organizationId = null,
    actorReq = null,
  }) {
    if (!Number.isFinite(points) || points <= 0) {
      throw ApiError.badRequest('points must be a positive integer.');
    }

    const cache = await this.#getOrCreateCache(patientId);
    const available = cache.currentBalance;
    const toClaw = Math.min(points, available);
    const shortfall = points - toClaw;

    let debitEntries = [];
    if (toClaw > 0) {
      debitEntries = await this.#debitFifo({
        patientId,
        branchId,
        points: toClaw,
        entryType: LOYALTY_ENTRY_TYPE.DEBIT_CLAWBACK,
        extraFields: { sourceRefType, sourceRefId, note: reasonNote },
        createdBy,
        organizationId,
      });

      cache.currentBalance = Math.max(0, cache.currentBalance - toClaw);
      cache.redeemableBalance = Math.max(0, cache.redeemableBalance - toClaw);
      cache.lastLedgerEntryId = debitEntries[debitEntries.length - 1]?._id || cache.lastLedgerEntryId;
      cache.recalculatedAt = new Date();
      await cache.save();
    }

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_POINTS_CLAWED_BACK, {
      actorId: createdBy,
      req: actorReq,
      branchId,
      resourceType: sourceRefType,
      resourceId: sourceRefId,
      metadata: { pointsRequested: points, pointsClawed: toClaw, shortfall, reasonNote },
    });

    if (shortfall > 0) {
      eventBus.emitDomain(LOYALTY_EVENTS.CLAWBACK_PENDING, {
        patientId: patientId.toString(),
        shortfall,
        sourceRefType,
        sourceRefId: sourceRefId?.toString?.() || sourceRefId,
      });
    }

    return {
      status: shortfall > 0 ? 'PENDING_INSUFFICIENT_BALANCE' : 'COMPLETED',
      pointsClawed: toClaw,
      shortfall,
      entries: debitEntries.map((e) => e.toSafeObject()),
    };
  }

  /** Manual credit/debit adjustment (LOY-008) — approval gating (staff-limit vs
   *  owner-approval-required) is enforced by the calling controller/service, not here; this
   *  method just writes the ledger entry once a decision has been made. */
  async manualAdjustment({
    branchId,
    patientId,
    points,
    direction, // 'CREDIT' | 'DEBIT'
    reasonCategory,
    note,
    approvedBy = null,
    createdBy = null,
    organizationId = null,
    actorReq = null,
  }) {
    if (!['CREDIT', 'DEBIT'].includes(direction)) {
      throw ApiError.badRequest('direction must be CREDIT or DEBIT.');
    }
    if (!reasonCategory) {
      throw ApiError.badRequest('reasonCategory is required for manual adjustments.');
    }

    if (direction === 'CREDIT') {
      return this.credit({
        branchId,
        patientId,
        points,
        entryType: LOYALTY_ENTRY_TYPE.MANUAL_CREDIT,
        reasonCategory,
        note,
        approvedBy,
        createdBy,
        organizationId,
        actorReq,
      });
    }

    const debitEntries = await this.#debitFifo({
      patientId,
      branchId,
      points,
      entryType: LOYALTY_ENTRY_TYPE.MANUAL_DEBIT,
      extraFields: { reasonCategory, note, approvedBy },
      createdBy,
      organizationId,
    });

    const cache = await this.#getOrCreateCache(patientId);
    cache.currentBalance = Math.max(0, cache.currentBalance - points);
    cache.redeemableBalance = Math.max(0, cache.redeemableBalance - points);
    cache.lastLedgerEntryId = debitEntries[debitEntries.length - 1]?._id || cache.lastLedgerEntryId;
    cache.recalculatedAt = new Date();
    await cache.save();

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_MANUAL_ADJUSTMENT, {
      actorId: createdBy,
      req: actorReq,
      branchId,
      resourceType: 'Patient',
      resourceId: patientId,
      metadata: { direction, points, reasonCategory, note, approvedBy },
    });

    return debitEntries.map((e) => e.toSafeObject());
  }

  /** Called by the expiry job (built separately) for one already-due lot. */
  async expireLot({ branchId, patientId, lotEntryId, points, organizationId = null }) {
    const debit = await LoyaltyLedgerEntry.create({
      organizationId,
      branchId,
      patientId,
      entryType: LOYALTY_ENTRY_TYPE.DEBIT_EXPIRY,
      points,
      consumesEntryId: lotEntryId,
    });

    const cache = await this.#getOrCreateCache(patientId);
    cache.currentBalance = Math.max(0, cache.currentBalance - points);
    cache.redeemableBalance = Math.max(0, cache.redeemableBalance - points);
    cache.lifetimeExpired += points;
    cache.lastLedgerEntryId = debit._id;
    cache.recalculatedAt = new Date();
    await cache.save();

    await this.auditService.record(AUDIT_ACTIONS.LOYALTY_POINTS_EXPIRED, {
      resourceType: 'LoyaltyLedgerEntry',
      resourceId: debit._id,
      branchId,
      metadata: { patientId: patientId.toString(), points, lotEntryId: lotEntryId.toString() },
    });

    eventBus.emitDomain(LOYALTY_EVENTS.POINTS_EXPIRED, {
      patientId: patientId.toString(),
      points,
    });

    return debit.toSafeObject();
  }

  /** Every lot due to expire within the next `withinDays` — used by the reminder job. */
  async findLotsExpiringWithin(withinDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    const lots = await LoyaltyLedgerEntry.find({
      entryType: { $in: LOYALTY_CREDIT_ENTRY_TYPES },
      earnLotExpiryDate: { $ne: null, $lte: cutoff },
    }).lean();

    const results = [];
    for (const lot of lots) {
      const consumed = await LoyaltyLedgerEntry.aggregate([
        { $match: { consumesEntryId: lot._id } },
        { $group: { _id: null, total: { $sum: '$points' } } },
      ]);
      const remaining = lot.points - (consumed[0]?.total || 0);
      if (remaining > 0) results.push({ ...lot, remaining });
    }
    return results;
  }

  async listLedger(patientId, { limit = 50, before = null } = {}) {
    const query = { patientId };
    if (before) query.createdAt = { $lt: before };
    const entries = await LoyaltyLedgerEntry.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return entries.map((e) => ({
      id: e._id.toString(),
      entryType: e.entryType,
      points: e.points,
      ruleCode: e.ruleCode,
      sourceRefType: e.sourceRefType,
      sourceRefId: e.sourceRefId?.toString?.() || null,
      note: e.note,
      createdAt: e.createdAt,
    }));
  }
}

export default LoyaltyLedgerService;
