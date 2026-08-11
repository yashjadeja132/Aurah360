import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import LoyaltyLedgerService from '../../src/services/LoyaltyLedgerService.js';
import LoyaltyEarningEngineService from '../../src/services/LoyaltyEarningEngineService.js';
import LoyaltyAdminService from '../../src/services/LoyaltyAdminService.js';
import LoyaltyLedgerEntry from '../../src/models/LoyaltyLedgerEntry.model.js';
import LoyaltyBalanceCache from '../../src/models/LoyaltyBalanceCache.model.js';
import LoyaltyProgramSettings from '../../src/models/LoyaltyProgramSettings.model.js';
import LoyaltyEarningRule from '../../src/models/LoyaltyEarningRule.model.js';
import LoyaltyAdjustmentRequest from '../../src/models/LoyaltyAdjustmentRequest.model.js';
import LoyaltyTier, { PatientTierState } from '../../src/models/LoyaltyTier.model.js';
import Invoice from '../../src/models/Invoice.model.js';
import RecallEntry from '../../src/models/RecallEntry.model.js';
import Patient from '../../src/models/Patient.model.js';
import { eventBus } from '../../src/events/eventBus.js';
import { registerLoyaltyEventListeners } from '../../src/loyalty/eventSubscriptions.js';
import { BILLING_EVENTS, INVOICE_STATUS } from '../../src/enums/billing.js';
import {
  LOYALTY_ADJUSTMENT_STATUS,
  LOYALTY_EARNING_EVENT,
  LOYALTY_ENTRY_TYPE,
} from '../../src/enums/loyalty.js';
import { ROLES } from '../../src/constants/roles.js';
import { PERMISSIONS } from '../../src/constants/permissions.js';
import TokenService from '../../src/services/TokenService.js';

/**
 * TIER-2 loyalty money integrity. Run against the real replica set — the double-spend fix rests
 * on transaction/write-conflict semantics and a unique index, neither of which a mock reproduces.
 * One suite (one test database) on purpose: the shared cluster is close to its collection cap.
 */
describe('Loyalty money integrity (real DB)', () => {
  const ledger = new LoyaltyLedgerService();
  const engine = new LoyaltyEarningEngineService();
  const admin = new LoyaltyAdminService();
  let patientId;
  let branchId;
  let otherBranchId;

  beforeAll(async () => {
    await connectTestDb('loymoney');
    // The unique idempotencyKey index is half the double-spend fix — syncIndexes (not init) so a
    // database carrying the older sparse form of it is corrected rather than kept.
    await LoyaltyLedgerEntry.syncIndexes();
    await LoyaltyBalanceCache.init();
    registerLoyaltyEventListeners();
  }, 60_000);

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await Promise.all([
      LoyaltyLedgerEntry.deleteMany({}),
      LoyaltyBalanceCache.deleteMany({}),
      LoyaltyProgramSettings.deleteMany({}),
      LoyaltyEarningRule.deleteMany({}),
      LoyaltyAdjustmentRequest.deleteMany({}),
      LoyaltyTier.deleteMany({}),
      PatientTierState.deleteMany({}),
      Invoice.deleteMany({}),
      RecallEntry.deleteMany({}),
      Patient.deleteMany({}),
    ]);
    patientId = new mongoose.Types.ObjectId();
    branchId = new mongoose.Types.ObjectId();
    otherBranchId = new mongoose.Types.ObjectId();
  });

  const settings = async (overrides = {}) =>
    LoyaltyProgramSettings.create({
      version: 1,
      effectiveFrom: new Date(Date.now() - 60_000),
      programEnabled: true,
      redemptionPointsPerRupee: 10,
      minimumPointsToRedeem: 100,
      redemptionStepPoints: 100,
      ...overrides,
    });

  const grant = async (points) =>
    ledger.credit({ branchId, patientId, points, entryType: LOYALTY_ENTRY_TYPE.CREDIT });

  const pointsOfType = async (entryType) => {
    const rows = await LoyaltyLedgerEntry.aggregate([
      { $match: { patientId, entryType } },
      { $group: { _id: null, total: { $sum: '$points' } } },
    ]);
    return rows[0]?.total || 0;
  };
  const redeemedTotal = () => pointsOfType(LOYALTY_ENTRY_TYPE.DEBIT_REDEEM);
  const earnedTotal = () => pointsOfType(LOYALTY_ENTRY_TYPE.CREDIT);

  /**
   * E6/E10 credit asynchronously off a domain event (safeHandle's fire-and-forget listener) —
   * a fixed setTimeout guessed at how long that takes, and under full-suite load (many files'
   * beforeAll connecting/registering listeners in the same process) that guess sometimes loses
   * the race, failing a real credit as if it never happened. Poll instead: wait until the total
   * actually reaches the expected value, or fail after a generous ceiling — deterministic on a
   * slow box, still fast (sub-second) on a quiet one.
   */
  const waitForEarnedTotal = async (expected, timeoutMs = 5000) => {
    const start = Date.now();
    let last = await earnedTotal();
    while (last !== expected && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => { setTimeout(resolve, 50); });
      last = await earnedTotal();
    }
    return last;
  };

  // ---- DEFECT 1: redemption double-spend ---------------------------------

  describe('redemption double-spend', () => {
    beforeEach(async () => {
      await settings();
    });

    it('lets only one of two concurrent redemptions of the whole balance succeed', async () => {
      await grant(1000);

      const results = await Promise.allSettled([
        ledger.redeem({ branchId, patientId, points: 1000, invoiceId: new mongoose.Types.ObjectId(), redeemedValueInr: 100 }),
        ledger.redeem({ branchId, patientId, points: 1000, invoiceId: new mongoose.Types.ObjectId(), redeemedValueInr: 100 }),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await redeemedTotal()).toBe(1000);

      const { currentBalance } = await ledger.computeBalanceFromLedger(patientId);
      expect(currentBalance).toBe(0);
      const cache = await LoyaltyBalanceCache.findOne({ patientId }).lean();
      expect(cache.currentBalance).toBe(0);
    });

    it('never drives the balance negative under many concurrent partial redemptions', async () => {
      await grant(1000);

      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () =>
          ledger.redeem({ branchId, patientId, points: 300, invoiceId: new mongoose.Types.ObjectId(), redeemedValueInr: 30 })
        )
      );

      // 1000 points at 300 per redemption leaves room for at most 3 winners.
      const winners = results.filter((r) => r.status === 'fulfilled').length;
      expect(winners).toBeGreaterThan(0);
      expect(winners).toBeLessThanOrEqual(3);
      expect(await redeemedTotal()).toBe(winners * 300);

      const { currentBalance } = await ledger.computeBalanceFromLedger(patientId);
      expect(currentBalance).toBe(1000 - winners * 300);
      const cache = await LoyaltyBalanceCache.findOne({ patientId }).lean();
      expect(cache.currentBalance).toBeGreaterThanOrEqual(0);
      expect(cache.currentBalance).toBe(currentBalance);
    });

    it('replays a retried redemption on the same idempotencyKey instead of spending twice', async () => {
      await grant(1000);
      const invoiceId = new mongoose.Types.ObjectId();
      const idempotencyKey = 'invoice-redeem:retry-me';

      const first = await ledger.redeem({ branchId, patientId, points: 500, invoiceId, redeemedValueInr: 50, idempotencyKey });
      const second = await ledger.redeem({ branchId, patientId, points: 500, invoiceId, redeemedValueInr: 50, idempotencyKey });

      expect(second.map((e) => e.id)).toEqual(first.map((e) => e.id));
      expect(await redeemedTotal()).toBe(500);
      const { currentBalance } = await ledger.computeBalanceFromLedger(patientId);
      expect(currentBalance).toBe(500);
    });

    it('rolls the whole redemption back when the balance is short', async () => {
      await grant(400);
      await expect(
        ledger.redeem({ branchId, patientId, points: 500, invoiceId: new mongoose.Types.ObjectId(), redeemedValueInr: 50 })
      ).rejects.toThrow(/Insufficient loyalty balance/);

      expect(await redeemedTotal()).toBe(0);
      const cache = await LoyaltyBalanceCache.findOne({ patientId }).lean();
      expect(cache.currentBalance).toBe(400);
    });
  });

  // ---- DEFECT 2: accrual timing ------------------------------------------

  describe('accrual happens on payment, not on finalize', () => {
    const makeInvoice = async (overrides = {}) =>
      Invoice.create({
        invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        patientId,
        branchId,
        status: INVOICE_STATUS.FINALIZED,
        subtotal: 1000,
        total: 1000,
        balanceAmount: 1000,
        ...overrides,
      });

    /** Listeners are async and fire-and-forget, so settle on the ledger rather than a timer. */
    const waitForEarned = async (expected, timeoutMs = 5000) => {
      const deadline = Date.now() + timeoutMs;
      let total = await earnedTotal();
      while (total !== expected && Date.now() < deadline) {
        await new Promise((resolve) => { setTimeout(resolve, 100); });
        total = await earnedTotal();
      }
      return total;
    };

    it('grants nothing on InvoiceFinalized and grants on InvoicePaid', async () => {
      await settings();
      await spendRule();
      const invoice = await makeInvoice();

      eventBus.emitDomain(BILLING_EVENTS.INVOICE_FINALIZED, {
        invoiceId: invoice._id.toString(),
        total: 1000,
        patientId: patientId.toString(),
      });
      // A finalized-but-unpaid invoice must never move the ledger — give the (absent) listener
      // the same grace period the paid assertion gets before concluding it did nothing.
      expect(await waitForEarned(10, 1500)).toBe(0);

      eventBus.emitDomain(BILLING_EVENTS.INVOICE_PAID, {
        invoiceId: invoice._id.toString(),
        total: 1000,
        patientId: patientId.toString(),
      });
      expect(await waitForEarned(10)).toBe(10);
    });

    it('excludes the points-paid portion from the earning base unless earnOnRedeemedPortion is on', async () => {
      await settings({ earnOnRedeemedPortion: false });
      await spendRule();
      // total is already NET of the ₹200 redemption, so the base is ₹800 → 8 points.
      const invoice = await makeInvoice({
        total: 800,
        loyaltyRedemption: { points: 2000, valueInr: 200, patientId },
      });

      eventBus.emitDomain(BILLING_EVENTS.INVOICE_PAID, {
        invoiceId: invoice._id.toString(),
        total: 800,
        patientId: patientId.toString(),
      });
      expect(await waitForEarned(8)).toBe(8);
    });

    it('adds the points-paid portion back into the earning base when earnOnRedeemedPortion is on', async () => {
      await settings({ earnOnRedeemedPortion: true });
      await spendRule();
      const invoice = await makeInvoice({
        total: 800,
        loyaltyRedemption: { points: 2000, valueInr: 200, patientId },
      });

      eventBus.emitDomain(BILLING_EVENTS.INVOICE_PAID, {
        invoiceId: invoice._id.toString(),
        total: 800,
        patientId: patientId.toString(),
      });
      expect(await waitForEarned(10)).toBe(10); // ₹800 + ₹200 redeemed = 10 points
    });
  });

  // ---- DEFECT 3: settings that must actually enforce something -----------

  const spendRule = async (version = {}) =>
    LoyaltyEarningRule.create({
      ruleCode: 'SPEND',
      eventType: LOYALTY_EARNING_EVENT.SPEND_BASED,
      name: 'Spend',
      versions: [
        {
          formulaType: 'PER_AMOUNT',
          pointValue: 1,
          perAmountInr: 100,
          effectiveFrom: new Date(Date.now() - 60_000),
          ...version,
        },
      ],
    });

  describe('branchOverrides', () => {
    it('awards the branch-override pointValue at the overridden branch only', async () => {
      await settings();
      await spendRule({ branchOverrides: { [otherBranchId.toString()]: { pointValue: 5 } } });

      await engine.resolveAndCredit(LOYALTY_EARNING_EVENT.SPEND_BASED, {
        patientId,
        branchId,
        amountInr: 1000,
        idempotencyKey: 'base-branch',
      });
      expect(await earnedTotal()).toBe(10); // 1000/100 * 1

      await engine.resolveAndCredit(LOYALTY_EARNING_EVENT.SPEND_BASED, {
        patientId,
        branchId: otherBranchId,
        amountInr: 1000,
        idempotencyKey: 'override-branch',
      });
      expect(await earnedTotal()).toBe(10 + 50); // 1000/100 * 5
    });
  });

  describe('tier earningMultiplier', () => {
    const goldTier = async () =>
      LoyaltyTier.create({
        name: 'Gold',
        rank: 2,
        qualificationBasis: 'POINTS_EARNED_ROLLING_12M',
        threshold: 0,
        earningMultiplier: 3,
      });

    it('multiplies an accrual by the patient tier multiplier when tiers are enabled', async () => {
      await settings({ tiersEnabled: true });
      await spendRule();
      await PatientTierState.create({ patientId, currentTierId: (await goldTier())._id });

      await engine.resolveAndCredit(LOYALTY_EARNING_EVENT.SPEND_BASED, {
        patientId,
        branchId,
        amountInr: 1000,
        idempotencyKey: 'tiered',
      });

      expect(await earnedTotal()).toBe(30); // 10 base * 3
    });

    it('ignores the tier multiplier while the tier system is switched off', async () => {
      await settings({ tiersEnabled: false });
      await spendRule();
      await PatientTierState.create({ patientId, currentTierId: (await goldTier())._id });

      await engine.resolveAndCredit(LOYALTY_EARNING_EVENT.SPEND_BASED, {
        patientId,
        branchId,
        amountInr: 1000,
        idempotencyKey: 'untiered',
      });

      expect(await earnedTotal()).toBe(10);
    });
  });

  describe('ruleChangeApprovalThresholdPercent', () => {
    const tokenService = new TokenService();
    const staffReq = { auth: { role: ROLES.RECEPTIONIST, permissions: [PERMISSIONS.LOYALTY_RULES_MANAGE] } };
    const bigChange = { formulaType: 'PER_AMOUNT', pointValue: 5, perAmountInr: 100 };
    /** SEC-002 — an above-threshold change additionally requires a verified step-up token; the
     *  approver-with-step-up request below carries one that matches its own actorId. */
    const ownerReqWithStepUp = (actorId) => ({
      auth: { role: ROLES.OWNER, permissions: [], userId: actorId.toString() },
      headers: { 'x-step-up-token': tokenService.signStepUpToken(actorId.toString()) },
    });

    it('refuses an above-threshold rule-value change from a non-approver', async () => {
      await settings({ ruleChangeApprovalThresholdPercent: 20 });
      const rule = await spendRule();

      await expect(
        admin.addRuleVersion(rule._id.toString(), bigChange, new mongoose.Types.ObjectId(), staffReq)
      ).rejects.toThrow(/approval threshold/);

      const unchanged = await LoyaltyEarningRule.findById(rule._id);
      expect(unchanged.versions).toHaveLength(1);
    });

    it('allows a within-threshold change from the same non-approver', async () => {
      await settings({ ruleChangeApprovalThresholdPercent: 20 });
      const rule = await spendRule();

      const updated = await admin.addRuleVersion(
        rule._id.toString(),
        { formulaType: 'PER_AMOUNT', pointValue: 1.1, perAmountInr: 100 },
        new mongoose.Types.ObjectId(),
        staffReq
      );
      expect(updated.versions).toHaveLength(2);
    });

    it('refuses an above-threshold change from an approver with no step-up token', async () => {
      await settings({ ruleChangeApprovalThresholdPercent: 20 });
      const rule = await spendRule();
      const ownerReqNoStepUp = { auth: { role: ROLES.OWNER, permissions: [] } };

      await expect(
        admin.addRuleVersion(rule._id.toString(), bigChange, new mongoose.Types.ObjectId(), ownerReqNoStepUp)
      ).rejects.toThrow(/[Ss]tep-up/);
    });

    it('lets an approver make the above-threshold change and stamps their approval', async () => {
      await settings({ ruleChangeApprovalThresholdPercent: 20 });
      const rule = await spendRule();
      const actorId = new mongoose.Types.ObjectId();

      const updated = await admin.addRuleVersion(rule._id.toString(), bigChange, actorId, ownerReqWithStepUp(actorId));
      const newest = updated.versions[updated.versions.length - 1];
      expect(newest.approvedBy).toBe(actorId.toString());
      expect(newest.approvedAt).toBeTruthy();
    });
  });

  // ---- GAP FIX: E6 ON_TIME_FOLLOW_UP ---------------------------------------

  describe('E6 ON_TIME_FOLLOW_UP', () => {
    const followUpRule = async (version = {}) =>
      LoyaltyEarningRule.create({
        ruleCode: 'ON_TIME_FOLLOWUP',
        eventType: LOYALTY_EARNING_EVENT.ON_TIME_FOLLOW_UP,
        name: 'On-time follow-up',
        versions: [
          {
            formulaType: 'FIXED',
            pointValue: 50,
            effectiveFrom: new Date(Date.now() - 60_000),
            ...version,
          },
        ],
      });

    it('credits when the fulfilling appointment completes within the grace window', async () => {
      await settings();
      await followUpRule({ graceWindowDays: 3 });
      const recallEntryId = new mongoose.Types.ObjectId();
      const dueDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago, within a 3-day grace

      eventBus.emitDomain('FollowUpAppointmentCompleted', {
        appointmentId: new mongoose.Types.ObjectId().toString(),
        recallEntryId: recallEntryId.toString(),
        patientId: patientId.toString(),
        branchId: branchId.toString(),
        dueDate: dueDate.toISOString(),
        completedAt: new Date().toISOString(),
      });

      expect(await waitForEarnedTotal(50)).toBe(50);
    });

    it('does not credit when the appointment completes after the grace window', async () => {
      await settings();
      await followUpRule({ graceWindowDays: 1 });
      const dueDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago, past a 1-day grace

      eventBus.emitDomain('FollowUpAppointmentCompleted', {
        appointmentId: new mongoose.Types.ObjectId().toString(),
        recallEntryId: new mongoose.Types.ObjectId().toString(),
        patientId: patientId.toString(),
        branchId: branchId.toString(),
        dueDate: dueDate.toISOString(),
        completedAt: new Date().toISOString(),
      });

      await new Promise((resolve) => { setTimeout(resolve, 300); });
      expect(await earnedTotal()).toBe(0);
    });

    it('never double-credits the same recall entry on a repeated event', async () => {
      await settings();
      await followUpRule({ graceWindowDays: 3 });
      const recallEntryId = new mongoose.Types.ObjectId().toString();
      const dueDate = new Date(Date.now() - 1000);
      const payload = {
        appointmentId: new mongoose.Types.ObjectId().toString(),
        recallEntryId,
        patientId: patientId.toString(),
        branchId: branchId.toString(),
        dueDate: dueDate.toISOString(),
        completedAt: new Date().toISOString(),
      };

      eventBus.emitDomain('FollowUpAppointmentCompleted', payload);
      expect(await waitForEarnedTotal(50)).toBe(50);
      eventBus.emitDomain('FollowUpAppointmentCompleted', payload);
      // Negative half of this assertion (no second credit) — nothing to poll toward, so a fixed
      // settle window is correct here, not a bug: waitForEarnedTotal would just spin to its
      // ceiling since 50 is already the (correct) steady state.
      await new Promise((resolve) => { setTimeout(resolve, 300); });

      expect(await earnedTotal()).toBe(50);
    });
  });

  // ---- GAP FIX: E10 PROFILE_COMPLETION -------------------------------------

  describe('E10 PROFILE_COMPLETION', () => {
    const profileRule = async (fields) =>
      LoyaltyEarningRule.create({
        ruleCode: 'PROFILE_COMPLETION',
        eventType: LOYALTY_EARNING_EVENT.PROFILE_COMPLETION,
        name: 'Profile completion',
        versions: [
          {
            formulaType: 'FIXED',
            pointValue: 25,
            effectiveFrom: new Date(Date.now() - 60_000),
            profileCompletionFields: fields,
          },
        ],
      });

    const makePatient = async (overrides = {}) =>
      Patient.create({
        mrn: `MRN${Date.now()}${Math.floor(Math.random() * 1000)}`,
        firstName: 'Test',
        lastName: 'Patient',
        gender: 'FEMALE',
        mobile: '9999999999',
        primaryBranchId: branchId,
        ...overrides,
      });

    it('credits once, the first time every configured field is non-empty', async () => {
      await settings();
      await profileRule(['email', 'dateOfBirth']);
      const patient = await makePatient({ email: 'a@b.com', dateOfBirth: new Date('1990-01-01') });
      patientId = patient._id;

      eventBus.emitDomain('PatientProfileUpdated', {
        patientId: patient._id.toString(),
        branchId: branchId.toString(),
        emittedAt: new Date().toISOString(),
      });
      expect(await waitForEarnedTotal(25)).toBe(25);

      // Repeat save — the engine's one-time-only ledger check must block a second credit.
      // Negative half (no second credit) — fixed settle window, same reasoning as E6 above.
      eventBus.emitDomain('PatientProfileUpdated', {
        patientId: patient._id.toString(),
        branchId: branchId.toString(),
        emittedAt: new Date().toISOString(),
      });
      await new Promise((resolve) => { setTimeout(resolve, 300); });
      expect(await earnedTotal()).toBe(25);
    });

    it('does not credit while a configured field is still empty', async () => {
      await settings();
      await profileRule(['email', 'dateOfBirth']);
      const patient = await makePatient({ email: 'a@b.com' }); // dateOfBirth left unset
      patientId = patient._id;

      eventBus.emitDomain('PatientProfileUpdated', {
        patientId: patient._id.toString(),
        branchId: branchId.toString(),
        emittedAt: new Date().toISOString(),
      });
      await new Promise((resolve) => { setTimeout(resolve, 300); });
      expect(await earnedTotal()).toBe(0);
    });
  });

  // ---- GAP FIX: LOY-005 redemption identity confirmation -------------------

  describe('redemptionIdentityConfirmation', () => {
    it('blocks a redemption with no identity confirmation when the setting requires it', async () => {
      await settings({ redemptionIdentityConfirmation: 'IN_PERSON' });
      await grant(1000);

      await expect(
        ledger.redeem({ branchId, patientId, points: 500, invoiceId: new mongoose.Types.ObjectId(), redeemedValueInr: 50 })
      ).rejects.toThrow(/identity/i);
      expect(await redeemedTotal()).toBe(0);
    });

    it('allows a redemption once identityConfirmed is supplied', async () => {
      await settings({ redemptionIdentityConfirmation: 'IN_PERSON' });
      await grant(1000);

      await ledger.redeem({
        branchId,
        patientId,
        points: 500,
        invoiceId: new mongoose.Types.ObjectId(),
        redeemedValueInr: 50,
        identityConfirmed: true,
      });
      expect(await redeemedTotal()).toBe(500);
    });

    it('additionally requires otpVerified in OTP mode', async () => {
      await settings({ redemptionIdentityConfirmation: 'OTP' });
      await grant(1000);

      await expect(
        ledger.redeem({
          branchId,
          patientId,
          points: 500,
          invoiceId: new mongoose.Types.ObjectId(),
          redeemedValueInr: 50,
          identityConfirmed: true,
        })
      ).rejects.toThrow(/otp/i);

      await ledger.redeem({
        branchId,
        patientId,
        points: 500,
        invoiceId: new mongoose.Types.ObjectId(),
        redeemedValueInr: 50,
        identityConfirmed: true,
        otpVerified: true,
      });
      expect(await redeemedTotal()).toBe(500);
    });

    it('imposes no gate when the setting is NONE (default legacy behaviour)', async () => {
      await settings({ redemptionIdentityConfirmation: 'NONE' });
      await grant(1000);

      await ledger.redeem({ branchId, patientId, points: 500, invoiceId: new mongoose.Types.ObjectId(), redeemedValueInr: 50 });
      expect(await redeemedTotal()).toBe(500);
    });
  });

  // ---- GAP FIX: LOY-006 refund re-credits redeemed points -------------------

  describe('credit() earnLotExpiryDateOverride (refund re-credit support)', () => {
    it('lets a CREDIT_REVERSAL pin an explicit expiry instead of computing one from settings', async () => {
      await settings({ pointsExpiryMonths: 12 });
      const explicitExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const entry = await ledger.credit({
        branchId,
        patientId,
        points: 500,
        entryType: LOYALTY_ENTRY_TYPE.CREDIT_REVERSAL,
        earnLotExpiryDateOverride: explicitExpiry,
      });

      expect(new Date(entry.earnLotExpiryDate).getTime()).toBe(explicitExpiry.getTime());
    });

    it('lets a CREDIT_REVERSAL restore a never-expiring lot by overriding with null', async () => {
      await settings({ pointsExpiryMonths: 12 });

      const entry = await ledger.credit({
        branchId,
        patientId,
        points: 500,
        entryType: LOYALTY_ENTRY_TYPE.CREDIT_REVERSAL,
        earnLotExpiryDateOverride: null,
      });

      expect(entry.earnLotExpiryDate).toBeNull();
    });
  });

  describe('manualAdjustmentPointLimitsByRole', () => {
    const adjustment = (points) => ({
      points,
      direction: 'CREDIT',
      reasonCategory: 'SERVICE_RECOVERY',
      note: 'goodwill gesture',
      branchId,
    });

    it('queues an approver-initiated adjustment above their role limit, applies one below it', async () => {
      await settings({ manualAdjustmentPointLimitsByRole: { [ROLES.BRANCH_MANAGER]: 500 } });
      const actor = { userId: new mongoose.Types.ObjectId(), role: ROLES.BRANCH_MANAGER };

      const over = await admin.createPatientAdjustment(patientId, adjustment(900), actor, null, true);
      expect(over.status).toBe(LOYALTY_ADJUSTMENT_STATUS.PENDING_APPROVAL);
      expect(over.ledgerEntryIds).toHaveLength(0);

      const within = await admin.createPatientAdjustment(patientId, adjustment(400), actor, null, true);
      expect(within.status).toBe(LOYALTY_ADJUSTMENT_STATUS.APPLIED);
      expect(await pointsOfType(LOYALTY_ENTRY_TYPE.MANUAL_CREDIT)).toBe(400);
    });

    it('leaves roles with no configured limit unrestricted', async () => {
      await settings({ manualAdjustmentPointLimitsByRole: { [ROLES.RECEPTIONIST]: 100 } });
      const actor = { userId: new mongoose.Types.ObjectId(), role: ROLES.BRANCH_MANAGER };

      const applied = await admin.createPatientAdjustment(patientId, adjustment(9000), actor, null, true);
      expect(applied.status).toBe(LOYALTY_ADJUSTMENT_STATUS.APPLIED);
    });
  });
});
