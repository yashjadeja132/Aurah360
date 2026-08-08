/**
 * Ad-hoc smoke test for the LOY-001/002/008/012/013/014 admin surface (not part of Vitest) —
 * mirrors smoke-loyalty-billing.js's style/isolated-DB convention and drives LoyaltyAdminService
 * directly rather than over HTTP (auth/permission wiring is covered by the route layer).
 *
 *  - updateSettings never mutates in place: each save is a NEW effective-dated version with an
 *    incremented version number and previousVersionId chained back to its predecessor.
 *  - addRuleVersion closes the currently-open version's effectiveTo at the new effectiveFrom, so
 *    rule.activeVersionAt(now) resolves to exactly one (the new) version.
 *  - Tier upsert create/update-by-id, and listTiers ordering by rank.
 *  - Campaign status transition to ACTIVE stamps approvedBy/approvedAt.
 *  - Manual adjustment approval workflow: a request the requester cannot auto-apply stays
 *    PENDING_APPROVAL and writes NO ledger entry; approveAdjustment writes the ledger entries and
 *    moves the balance; rejectAdjustment leaves the balance untouched.
 *  - getDashboardSummary's outstanding liability = issued - redeemed - expired - clawedback
 *    - manualDebit over the seeded ledger.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import '../models/index.js'; // registers every model so populate() paths resolve
import Branch from '../models/Branch.model.js';
import Patient from '../models/Patient.model.js';
import LoyaltyProgramSettings from '../models/LoyaltyProgramSettings.model.js';
import LoyaltyEarningRule from '../models/LoyaltyEarningRule.model.js';
import LoyaltyLedgerEntry from '../models/LoyaltyLedgerEntry.model.js';
import LoyaltyAdjustmentRequest from '../models/LoyaltyAdjustmentRequest.model.js';
import LoyaltyAdminService from '../services/LoyaltyAdminService.js';
import LoyaltyLedgerService from '../services/LoyaltyLedgerService.js';
import {
  LOYALTY_ADJUSTMENT_STATUS,
  LOYALTY_EARNING_EVENT,
  LOYALTY_ENTRY_TYPE,
  LOYALTY_MANUAL_REASON_CATEGORY,
} from '../enums/loyalty.js';

import { smokeDbUri } from './smokeDbUri.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  await mongoose.connect(smokeDbUri(config.mongo.uri, 'aurah360_smoke_loyalty_admin'));
  await mongoose.connection.dropDatabase();

  const branch = await Branch.create({
    name: 'Loyalty Admin Smoke Branch',
    branchCode: `LAS-${Date.now()}`,
    displayName: 'Loyalty Admin Smoke Branch',
    email: `loyalty-admin-smoke-${Date.now()}@example.com`,
    phone: '9800000002',
  });

  const patient = await Patient.create({
    mrn: `MRN-LOYADM-${Date.now()}`,
    firstName: 'Loyalty',
    lastName: 'Admin',
    gender: 'FEMALE',
    mobile: '9833333333',
    primaryBranchId: branch._id,
  });

  const ownerId = new mongoose.Types.ObjectId(); // holds LOYALTY_ADJUST_APPROVE
  const staffId = new mongoose.Types.ObjectId(); // does not — their adjustments must queue
  const admin = new LoyaltyAdminService();
  const ledger = new LoyaltyLedgerService();

  // ---------------------------------------------------------------------------------------
  // Part 1 — settings are versioned, never mutated in place (v1 -> v2 chained)
  // ---------------------------------------------------------------------------------------
  const v1 = await admin.updateSettings(
    {
      programEnabled: true,
      programDisplayName: 'Aurah Rewards',
      redemptionPointsPerRupee: 10, // 10 points = ₹1
      minimumPointsToRedeem: 100,
      redemptionStepPoints: 100,
      maxRedemptionPercentPerInvoice: 50,
      pointsExpiryMonths: 12,
    },
    ownerId,
    null
  );
  assert(v1.version === 1, `First settings save should be version 1, got ${v1.version}`);
  assert(v1.previousVersionId === null, 'Version 1 must not chain to a previous version');

  const v2 = await admin.updateSettings({ programDisplayName: 'Aurah Rewards Plus' }, ownerId, null);
  assert(v2.version === 2, `Second settings save should be version 2, got ${v2.version}`);
  assert(v2.id !== v1.id, 'Version 2 must be a NEW document, not an update of version 1');
  assert(
    v2.previousVersionId === v1.id,
    `Version 2 previousVersionId should chain to v1 (${v1.id}), got ${v2.previousVersionId}`
  );
  // Unspecified fields are carried forward from the version being superseded.
  assert(v2.programEnabled === true, 'programEnabled should carry forward into the new version');
  assert(
    v2.redemptionPointsPerRupee === 10,
    `redemptionPointsPerRupee should carry forward as 10, got ${v2.redemptionPointsPerRupee}`
  );
  assert(v2.programDisplayName === 'Aurah Rewards Plus', 'programDisplayName should be the newly supplied value');

  const settingsCount = await LoyaltyProgramSettings.countDocuments();
  assert(settingsCount === 2, `Expected 2 settings documents (append-only history), got ${settingsCount}`);
  const active = await admin.getSettings();
  assert(active.id === v2.id, 'getSettings must return the latest-effectiveFrom version');
  console.log('(1) updateSettings creates a new version with incremented version + previousVersionId chain: PASS');

  // ---------------------------------------------------------------------------------------
  // Part 2 — rule versions are effective-dated; a new version closes the open one
  // ---------------------------------------------------------------------------------------
  const versionOneFrom = new Date(Date.now() - 60 * 60 * 1000); // an hour ago
  const created = await admin.createRule(
    {
      ruleCode: 'SMOKE-E2-SPEND',
      eventType: LOYALTY_EARNING_EVENT.SPEND_BASED,
      name: 'Smoke spend-based points',
      version: {
        formulaType: 'PER_AMOUNT',
        pointValue: 1,
        perAmountInr: 100,
        effectiveFrom: versionOneFrom.toISOString(),
      },
    },
    ownerId,
    null
  );
  assert(created.versions.length === 1, `A new rule should start with exactly 1 version, got ${created.versions.length}`);
  assert(created.versions[0].effectiveTo === null, 'The only version of a new rule must be open-ended');
  const versionOneId = created.versions[0].id;

  const versionTwoFrom = new Date(Date.now() - 1000); // a second ago, so activeVersionAt(now) sees it
  const withV2 = await admin.addRuleVersion(
    created.id,
    { formulaType: 'PER_AMOUNT', pointValue: 2, perAmountInr: 100, effectiveFrom: versionTwoFrom.toISOString() },
    ownerId,
    null
  );
  assert(withV2.versions.length === 2, `Expected 2 rule versions after addRuleVersion, got ${withV2.versions.length}`);
  const oldVersion = withV2.versions.find((v) => v.id === versionOneId);
  const newVersion = withV2.versions.find((v) => v.id !== versionOneId);
  assert(oldVersion, 'The original version must still be present (history is never deleted)');
  assert(
    oldVersion.effectiveTo && new Date(oldVersion.effectiveTo).getTime() === versionTwoFrom.getTime(),
    `Previously-open version's effectiveTo should be closed at the new effectiveFrom (${versionTwoFrom.toISOString()}), got ${oldVersion.effectiveTo}`
  );
  assert(newVersion.effectiveTo === null, 'The newly added version must be the open-ended one');
  assert(newVersion.pointValue === 2, `New version should carry the new pointValue 2, got ${newVersion.pointValue}`);

  const ruleDoc = await LoyaltyEarningRule.findById(created.id);
  const activeVersion = ruleDoc.activeVersionAt(new Date());
  assert(activeVersion, 'activeVersionAt(now) should resolve to a version');
  assert(
    activeVersion._id.toString() === newVersion.id,
    `activeVersionAt(now) should resolve to the NEW version (${newVersion.id}), got ${activeVersion._id.toString()}`
  );
  // And the historical window still resolves to the old version — a later edit never rewrites history.
  const historicVersion = ruleDoc.activeVersionAt(new Date(Date.now() - 30 * 60 * 1000));
  assert(
    historicVersion && historicVersion._id.toString() === versionOneId,
    'A date inside version 1s window must still resolve to version 1'
  );
  console.log('(2) addRuleVersion closes the open version and activeVersionAt(now) resolves to the new one: PASS');

  // ---------------------------------------------------------------------------------------
  // Part 3 — tier upsert (create then update by id) and listTiers rank ordering
  // ---------------------------------------------------------------------------------------
  const gold = await admin.upsertTier(null, {
    name: 'Gold',
    rank: 2,
    qualificationBasis: 'POINTS_EARNED_ROLLING_12M',
    threshold: 5000,
    earningMultiplier: 2,
  });
  assert(gold.id, 'upsertTier(null, ...) should create a tier');
  const silver = await admin.upsertTier(null, {
    name: 'Silver',
    rank: 5, // deliberately out of order — corrected by the update below
    qualificationBasis: 'POINTS_EARNED_ROLLING_12M',
    threshold: 1000,
  });

  const silverUpdated = await admin.upsertTier(silver.id, { rank: 1, threshold: 1200 });
  assert(silverUpdated.id === silver.id, 'upsertTier with an id must update in place, not create a new tier');
  assert(silverUpdated.rank === 1, `Silver rank should be updated to 1, got ${silverUpdated.rank}`);
  assert(silverUpdated.threshold === 1200, `Silver threshold should be updated to 1200, got ${silverUpdated.threshold}`);
  assert(silverUpdated.name === 'Silver', 'A partial update must not clobber untouched fields');

  const tiers = await admin.listTiers();
  assert(tiers.length === 2, `Expected exactly 2 active tiers, got ${tiers.length}`);
  assert(
    tiers.map((t) => t.name).join(',') === 'Silver,Gold',
    `listTiers should be ordered by rank ascending (Silver,Gold), got ${tiers.map((t) => t.name).join(',')}`
  );
  assert(
    tiers[0].rank < tiers[1].rank,
    `listTiers ranks must ascend, got ${tiers[0].rank} then ${tiers[1].rank}`
  );
  console.log('(3) tier create/update-by-id and listTiers rank ordering: PASS');

  // ---------------------------------------------------------------------------------------
  // Part 4 — campaign create + activation stamps approvedBy/approvedAt
  // ---------------------------------------------------------------------------------------
  const campaign = await admin.createCampaign(
    {
      name: 'Smoke Double Points Week',
      multiplier: 2,
      appliesToRuleCodes: ['SMOKE-E2-SPEND'],
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    },
    ownerId,
    null
  );
  assert(campaign.status === 'DRAFT', `A new campaign should default to DRAFT, got ${campaign.status}`);
  assert(campaign.approvedBy === null, 'A DRAFT campaign must not be pre-approved');

  const activated = await admin.updateCampaignStatus(campaign.id, 'ACTIVE', ownerId, null);
  assert(activated.status === 'ACTIVE', `Campaign should be ACTIVE, got ${activated.status}`);
  assert(
    activated.approvedBy === ownerId.toString(),
    `Activating should stamp approvedBy with the actor (${ownerId.toString()}), got ${activated.approvedBy}`
  );
  assert(activated.approvedAt instanceof Date, 'Activating should stamp approvedAt');
  console.log('(4) campaign create + activation stamps approvedBy/approvedAt: PASS');

  // ---------------------------------------------------------------------------------------
  // Part 5 — manual adjustment approval workflow (queue -> approve / reject)
  // ---------------------------------------------------------------------------------------
  // Seed a starting balance so a DEBIT-direction request would have something to consume.
  await ledger.credit({
    branchId: branch._id,
    patientId: patient._id,
    points: 1000,
    entryType: LOYALTY_ENTRY_TYPE.MANUAL_CREDIT,
    reasonCategory: LOYALTY_MANUAL_REASON_CATEGORY.PROMOTION,
    note: 'Smoke setup balance',
    approvedBy: ownerId,
    createdBy: ownerId,
  });

  const balanceBeforeRequest = (await ledger.getBalance(patient._id)).currentBalance;
  assert(balanceBeforeRequest === 1000, `Expected seeded balance of 1000, got ${balanceBeforeRequest}`);
  const ledgerCountBeforeRequest = await LoyaltyLedgerEntry.countDocuments({ patientId: patient._id });

  // canAutoApply = false — the requester lacks LOYALTY_ADJUST_APPROVE, so this must only QUEUE.
  const pending = await admin.createPatientAdjustment(
    patient._id,
    {
      direction: 'CREDIT',
      points: 300,
      reasonCategory: LOYALTY_MANUAL_REASON_CATEGORY.SERVICE_RECOVERY,
      note: 'Goodwill for a delayed appointment',
    },
    { userId: staffId },
    null,
    false
  );
  assert(
    pending.status === LOYALTY_ADJUSTMENT_STATUS.PENDING_APPROVAL,
    `A non-auto-appliable adjustment should be PENDING_APPROVAL, got ${pending.status}`
  );
  assert(pending.ledgerEntryIds.length === 0, 'A pending request must not reference any ledger entry');
  assert(pending.decidedBy === null, 'A pending request must have no decision recorded');
  assert(pending.entryType === 'MANUAL_CREDIT', 'A CREDIT-direction request surfaces as MANUAL_CREDIT to the UI');
  assert(
    pending.branchId === branch._id.toString(),
    'branchId should be resolved from the patients primary branch when not supplied'
  );

  const ledgerCountAfterRequest = await LoyaltyLedgerEntry.countDocuments({ patientId: patient._id });
  assert(
    ledgerCountAfterRequest === ledgerCountBeforeRequest,
    `A PENDING_APPROVAL request must write NO ledger entry — count went ${ledgerCountBeforeRequest} -> ${ledgerCountAfterRequest}`
  );
  const balanceWhilePending = (await ledger.getBalance(patient._id)).currentBalance;
  assert(
    balanceWhilePending === balanceBeforeRequest,
    `Balance must not move while a request is pending, expected ${balanceBeforeRequest}, got ${balanceWhilePending}`
  );

  const queue = await admin.listAdjustmentQueue({ patientId: patient._id });
  assert(queue.length === 1, `Expected exactly 1 pending request in the queue, got ${queue.length}`);
  assert(queue[0].id === pending.id, 'The queued request should be the one just created');
  console.log('(5) createPatientAdjustment(canAutoApply=false) queues PENDING_APPROVAL with no ledger write: PASS');

  const approved = await admin.approveAdjustment(pending.id, { decisionNote: 'Approved by owner' }, ownerId, null);
  assert(
    approved.status === LOYALTY_ADJUSTMENT_STATUS.APPROVED,
    `Approving should set status APPROVED, got ${approved.status}`
  );
  assert(approved.decidedBy === ownerId.toString(), 'Approving should record decidedBy as the approver');
  assert(approved.decidedAt instanceof Date, 'Approving should record decidedAt');
  assert(approved.decisionNote === 'Approved by owner', 'Approving should persist the decision note');
  assert(
    approved.ledgerEntryIds.length > 0,
    'Approving must populate ledgerEntryIds with the entries it wrote'
  );

  const approvedEntries = await LoyaltyLedgerEntry.find({ _id: { $in: approved.ledgerEntryIds } }).lean();
  assert(
    approvedEntries.length === approved.ledgerEntryIds.length,
    'Every id in ledgerEntryIds must resolve to a real ledger entry'
  );
  const approvedPoints = approvedEntries.reduce((sum, e) => sum + e.points, 0);
  assert(approvedPoints === 300, `Approved entries should total the requested 300 points, got ${approvedPoints}`);
  assert(
    approvedEntries.every((e) => e.entryType === LOYALTY_ENTRY_TYPE.MANUAL_CREDIT),
    'A CREDIT-direction approval must write MANUAL_CREDIT entries'
  );
  assert(
    approvedEntries.every((e) => e.approvedBy?.toString() === ownerId.toString()),
    'Ledger entries must carry the approver on approvedBy'
  );

  const balanceAfterApproval = (await ledger.getBalance(patient._id)).currentBalance;
  assert(
    balanceAfterApproval === balanceBeforeRequest + 300,
    `Balance should move by exactly +300, expected ${balanceBeforeRequest + 300}, got ${balanceAfterApproval}`
  );
  const derivedAfterApproval = await ledger.computeBalanceFromLedger(patient._id);
  assert(
    derivedAfterApproval.currentBalance === balanceAfterApproval,
    `Cache (${balanceAfterApproval}) must agree with the ledger-derived balance (${derivedAfterApproval.currentBalance})`
  );

  // Approving twice must be refused — the ledger is never double-written.
  let doubleApproveRejected = false;
  try {
    await admin.approveAdjustment(pending.id, {}, ownerId, null);
  } catch (err) {
    doubleApproveRejected = true;
    console.log('(6) re-approving an already-approved request rejected:', err.message);
  }
  assert(doubleApproveRejected, 'Only PENDING_APPROVAL requests may be approved');
  console.log('(7) approveAdjustment writes the ledger, sets APPROVED and moves the balance by exactly +300: PASS');

  // Second request — this one gets rejected, and must leave the balance untouched.
  const toReject = await admin.createPatientAdjustment(
    patient._id,
    {
      direction: 'CREDIT',
      points: 250,
      reasonCategory: LOYALTY_MANUAL_REASON_CATEGORY.PROMOTION,
      note: 'Speculative promo credit',
    },
    { userId: staffId },
    null,
    false
  );
  assert(
    toReject.status === LOYALTY_ADJUSTMENT_STATUS.PENDING_APPROVAL,
    `The second request should also queue, got ${toReject.status}`
  );
  const ledgerCountBeforeReject = await LoyaltyLedgerEntry.countDocuments({ patientId: patient._id });

  const rejected = await admin.rejectAdjustment(toReject.id, { decisionNote: 'Not justified' }, ownerId, null);
  assert(
    rejected.status === LOYALTY_ADJUSTMENT_STATUS.REJECTED,
    `Rejecting should set status REJECTED, got ${rejected.status}`
  );
  assert(rejected.decidedBy === ownerId.toString(), 'Rejecting should record decidedBy');
  assert(rejected.decisionNote === 'Not justified', 'Rejecting should persist the decision note');
  assert(rejected.ledgerEntryIds.length === 0, 'A rejected request must never reference ledger entries');

  const ledgerCountAfterReject = await LoyaltyLedgerEntry.countDocuments({ patientId: patient._id });
  assert(
    ledgerCountAfterReject === ledgerCountBeforeReject,
    `Rejecting must write NO ledger entry — count went ${ledgerCountBeforeReject} -> ${ledgerCountAfterReject}`
  );
  const balanceAfterReject = (await ledger.getBalance(patient._id)).currentBalance;
  assert(
    balanceAfterReject === balanceAfterApproval,
    `Balance must be UNCHANGED after a rejection, expected ${balanceAfterApproval}, got ${balanceAfterReject}`
  );

  const remainingQueue = await admin.listAdjustmentQueue({ patientId: patient._id });
  assert(remainingQueue.length === 0, `The pending queue should be empty after both decisions, got ${remainingQueue.length}`);
  const decidedCount = await LoyaltyAdjustmentRequest.countDocuments({ patientId: patient._id });
  assert(decidedCount === 2, `Both requests should be retained as an audit trail, got ${decidedCount}`);
  console.log('(8) rejectAdjustment sets REJECTED and leaves the balance untouched: PASS');

  // ---------------------------------------------------------------------------------------
  // Part 6 — dashboard summary: outstanding liability = issued - redeemed - expired
  //          - clawedback - manualDebit over every seeded entry type
  // ---------------------------------------------------------------------------------------
  // Seed one of every remaining entry type so the subtraction is actually exercised.
  const earned = await ledger.credit({
    branchId: branch._id,
    patientId: patient._id,
    points: 800,
    entryType: LOYALTY_ENTRY_TYPE.CREDIT,
    sourceRefType: 'INVOICE',
    sourceRefId: new mongoose.Types.ObjectId(),
    createdBy: ownerId,
  });
  await ledger.redeem({
    branchId: branch._id,
    patientId: patient._id,
    points: 200,
    invoiceId: new mongoose.Types.ObjectId(),
    redeemedValueInr: 20,
    createdBy: ownerId,
  });
  await ledger.clawback({
    branchId: branch._id,
    patientId: patient._id,
    points: 100,
    sourceRefType: 'INVOICE',
    sourceRefId: new mongoose.Types.ObjectId(),
    reasonNote: 'Smoke refund clawback',
    createdBy: ownerId,
  });
  await ledger.expireLot({
    branchId: branch._id,
    patientId: patient._id,
    lotEntryId: new mongoose.Types.ObjectId(earned.id),
    points: 50,
  });
  await ledger.manualAdjustment({
    branchId: branch._id,
    patientId: patient._id,
    points: 60,
    direction: 'DEBIT',
    reasonCategory: LOYALTY_MANUAL_REASON_CATEGORY.CORRECTION,
    note: 'Smoke correction debit',
    approvedBy: ownerId,
    createdBy: ownerId,
  });

  // Seeded totals: MANUAL_CREDIT 1000 + 300 (approval) = 1300, CREDIT 800  -> issued 2100
  //                DEBIT_REDEEM 200, DEBIT_EXPIRY 50, DEBIT_CLAWBACK 100, MANUAL_DEBIT 60
  const expectedIssued = 1000 + 300 + 800;
  const expectedRedeemed = 200;
  const expectedExpired = 50;
  const expectedClawedBack = 100;
  const expectedManualDebit = 60;
  const expectedOutstanding =
    expectedIssued - expectedRedeemed - expectedExpired - expectedClawedBack - expectedManualDebit;

  const summary = await admin.getDashboardSummary();
  assert(summary.totalIssued === expectedIssued, `Expected totalIssued ${expectedIssued}, got ${summary.totalIssued}`);
  assert(
    summary.totalRedeemed === expectedRedeemed,
    `Expected totalRedeemed ${expectedRedeemed}, got ${summary.totalRedeemed}`
  );
  assert(summary.totalExpired === expectedExpired, `Expected totalExpired ${expectedExpired}, got ${summary.totalExpired}`);
  assert(
    summary.totalClawedBack === expectedClawedBack,
    `Expected totalClawedBack ${expectedClawedBack}, got ${summary.totalClawedBack}`
  );
  const reportedManualDebit = summary.byEntryType[LOYALTY_ENTRY_TYPE.MANUAL_DEBIT]?.points || 0;
  assert(
    reportedManualDebit === expectedManualDebit,
    `Expected MANUAL_DEBIT ${expectedManualDebit} in byEntryType, got ${reportedManualDebit}`
  );
  assert(
    summary.outstandingLiabilityPoints === expectedOutstanding,
    `Expected outstandingLiabilityPoints ${expectedOutstanding}, got ${summary.outstandingLiabilityPoints}`
  );
  // Re-derive the same figure from the reported components rather than trusting the constant.
  const recomputed =
    summary.totalIssued -
    summary.totalRedeemed -
    summary.totalExpired -
    summary.totalClawedBack -
    reportedManualDebit;
  assert(
    summary.outstandingLiabilityPoints === recomputed,
    `outstandingLiabilityPoints (${summary.outstandingLiabilityPoints}) must equal issued - redeemed - expired - clawedback - manualDebit (${recomputed})`
  );
  // Priced at the ACTIVE settings version's conversion rate (10 points = ₹1).
  assert(
    summary.outstandingLiabilityInr === Math.round((expectedOutstanding / 10) * 100) / 100,
    `Expected outstandingLiabilityInr ${expectedOutstanding / 10}, got ${summary.outstandingLiabilityInr}`
  );
  assert(
    summary.pendingAdjustments === 0,
    `Expected 0 pending adjustments after both decisions, got ${summary.pendingAdjustments}`
  );
  console.log('(9) getDashboardSummary outstanding liability = issued - redeemed - expired - clawedback - manualDebit: PASS');

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch(async (err) => {
  console.error('SMOKE FAIL', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
