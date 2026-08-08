/**
 * Ad-hoc smoke test for LOY-005/LOY-006 (not part of Vitest) — mirrors smoke-discount-approval.js
 * and smoke-session-complete.js's style/isolated-DB convention.
 *
 *  - Applying a loyalty redemption to a draft invoice: converts points to a discount via
 *    LoyaltyProgramSettings, is capped against the redeemable base (excluding
 *    excludedRedemptionCategories), flows through the same discount-approval threshold check,
 *    and writes a DEBIT_REDEEM ledger entry.
 *  - Removing a redemption reverses it with a CREDIT_REVERSAL entry and drops the discount.
 *  - Refunding an invoice claws back only points EARNED (CREDIT) from that invoice, never
 *    points REDEEMED (DEBIT_REDEEM).
 */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import '../models/index.js'; // registers every model so populate() paths resolve
import Branch from '../models/Branch.model.js';
import Patient from '../models/Patient.model.js';
import LoyaltyProgramSettings from '../models/LoyaltyProgramSettings.model.js';
import LoyaltyLedgerEntry from '../models/LoyaltyLedgerEntry.model.js';
import BillingService from '../services/BillingService.js';
import LoyaltyLedgerService from '../services/LoyaltyLedgerService.js';
import { DISCOUNT_TYPE, INVOICE_ITEM_TYPE, INVOICE_STATUS } from '../enums/billing.js';
import { LOYALTY_ENTRY_TYPE } from '../enums/loyalty.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

import { smokeDbUri } from './smokeDbUri.js';

async function sumPoints(filter) {
  const rows = await LoyaltyLedgerEntry.aggregate([
    { $match: filter },
    { $group: { _id: null, total: { $sum: '$points' } } },
  ]);
  return rows[0]?.total || 0;
}

async function main() {
  await mongoose.connect(smokeDbUri(config.mongo.uri, 'aurah360_smoke_loyalty_billing'));
  await mongoose.connection.dropDatabase();

  console.log('Configured discount-approval threshold percent:', config.billing.discountApprovalThresholdPercent);

  const branch = await Branch.create({
    name: 'Loyalty Billing Smoke Branch',
    branchCode: `LBS-${Date.now()}`,
    displayName: 'Loyalty Billing Smoke Branch',
    email: `loyalty-billing-smoke-${Date.now()}@example.com`,
    phone: '9800000001',
  });

  const patient = await Patient.create({
    mrn: `MRN-LOY-${Date.now()}`,
    firstName: 'Loyalty',
    lastName: 'Smoke',
    gender: 'FEMALE',
    mobile: '9822222222',
    primaryBranchId: branch._id,
  });

  await LoyaltyProgramSettings.create({
    programEnabled: true,
    redemptionPointsPerRupee: 10, // 10 points = ₹1
    minimumPointsToRedeem: 100,
    redemptionStepPoints: 100,
    maxRedemptionPercentPerInvoice: 50,
    maxRedemptionFlatInrPerInvoice: null,
    excludedRedemptionCategories: [INVOICE_ITEM_TYPE.MEDICINE],
    pointsExpiryMonths: null,
    effectiveFrom: new Date(Date.now() - 60 * 1000),
  });

  const actorId = new mongoose.Types.ObjectId();
  const billing = new BillingService();
  const ledger = new LoyaltyLedgerService();

  // Give the patient a starting balance unrelated to any invoice (general goodwill credit).
  await ledger.credit({
    branchId: branch._id,
    patientId: patient._id,
    points: 1000,
    entryType: LOYALTY_ENTRY_TYPE.MANUAL_CREDIT,
    reasonCategory: 'PROMOTION',
    note: 'Smoke setup balance',
    createdBy: actorId,
  });

  // ---------------------------------------------------------------------------------------
  // Part 1 — redemption cap enforcement (excludedRedemptionCategories excluded from base)
  // ---------------------------------------------------------------------------------------
  const invoiceB = await billing.create(
    {
      patientId: patient._id.toString(),
      branchId: branch._id.toString(),
      items: [
        { itemType: INVOICE_ITEM_TYPE.SERVICE, description: 'Facial', quantity: 1, unitPrice: 1500 },
        { itemType: INVOICE_ITEM_TYPE.MEDICINE, description: 'Cream', quantity: 1, unitPrice: 500 },
      ],
      discountType: DISCOUNT_TYPE.FLAT,
      discountValue: 0,
    },
    actorId
  );
  // Redeemable base excludes the ₹500 MEDICINE line -> base = ₹1500, cap @50% = ₹750.
  // 8000 points / 10 = ₹800 discount, over the ₹750 cap -> must be rejected.
  let capRejected = false;
  try {
    await billing.applyLoyaltyRedemption(invoiceB.id, { points: 8000 }, actorId);
  } catch (err) {
    capRejected = true;
    console.log('(1) over-cap redemption rejected: PASS —', err.message);
  }
  assert(capRejected, 'Redemption exceeding the program cap should have been rejected');

  // Within cap: 500 points / 10 = ₹50 discount.
  const afterRedeem = await billing.applyLoyaltyRedemption(invoiceB.id, { points: 500 }, actorId);
  assert(afterRedeem.loyaltyRedemption?.points === 500, 'loyaltyRedemption.points should be 500');
  assert(afterRedeem.loyaltyRedemption?.valueInr === 50, 'loyaltyRedemption.valueInr should be ₹50');
  assert(afterRedeem.discount === 50, `Expected invoice discount 50, got ${afterRedeem.discount}`);
  console.log('(2) within-cap redemption applied, discount reflects it: PASS');

  const debitRedeemForB = await sumPoints({
    sourceRefType: 'INVOICE',
    sourceRefId: invoiceB._id || new mongoose.Types.ObjectId(afterRedeem.id),
    entryType: LOYALTY_ENTRY_TYPE.DEBIT_REDEEM,
  });
  assert(debitRedeemForB === 500, `Expected 500 DEBIT_REDEEM points on invoice B ledger, got ${debitRedeemForB}`);
  console.log('(3) ledger has DEBIT_REDEEM entry for the redeemed points: PASS');

  // A second redemption attempt while one is already applied must be rejected.
  let duplicateRejected = false;
  try {
    await billing.applyLoyaltyRedemption(invoiceB.id, { points: 100 }, actorId);
  } catch (err) {
    duplicateRejected = true;
    console.log('(4) duplicate redemption on same draft rejected: PASS —', err.message);
  }
  assert(duplicateRejected, 'Applying a second redemption while one is active should be rejected');

  // Remove it — should reverse via CREDIT_REVERSAL and drop the discount.
  const afterRemove = await billing.removeLoyaltyRedemption(invoiceB.id, actorId);
  assert(afterRemove.loyaltyRedemption === null, 'loyaltyRedemption should be cleared after removal');
  assert(afterRemove.discount === 0, `Expected discount back to 0, got ${afterRemove.discount}`);
  const reversalForB = await sumPoints({
    sourceRefType: 'INVOICE',
    sourceRefId: new mongoose.Types.ObjectId(afterRemove.id),
    entryType: LOYALTY_ENTRY_TYPE.CREDIT_REVERSAL,
  });
  assert(reversalForB === 500, `Expected 500 CREDIT_REVERSAL points after removal, got ${reversalForB}`);
  console.log('(5) removing redemption reverses ledger (CREDIT_REVERSAL) and clears discount: PASS');

  // Re-apply and finalize the invoice — draft-only endpoints, then a normal finalize.
  const reApplied = await billing.applyLoyaltyRedemption(invoiceB.id, { points: 500 }, actorId);
  assert(reApplied.loyaltyRedemption?.points === 500, 'Re-applied redemption should stick');
  const finalizedB = await billing.finalize(invoiceB.id, actorId);
  assert(finalizedB.status === INVOICE_STATUS.FINALIZED, 'Invoice B should finalize with a within-cap redemption');
  console.log('(6) invoice with redemption finalizes normally: PASS');

  // ---------------------------------------------------------------------------------------
  // Part 2 — refund clawback claws EARNED points only, never REDEEMED points
  // ---------------------------------------------------------------------------------------
  const invoiceA = await billing.create(
    {
      patientId: patient._id.toString(),
      branchId: branch._id.toString(),
      items: [{ itemType: INVOICE_ITEM_TYPE.SERVICE, description: 'Consultation', quantity: 1, unitPrice: 1000 }],
      discountType: DISCOUNT_TYPE.FLAT,
      discountValue: 0,
    },
    actorId
  );
  const invoiceAId = new mongoose.Types.ObjectId(invoiceA.id);

  // Simulate the earning engine crediting 1000 points for this invoice.
  await ledger.credit({
    branchId: branch._id,
    patientId: patient._id,
    points: 1000,
    entryType: LOYALTY_ENTRY_TYPE.CREDIT,
    sourceRefType: 'INVOICE',
    sourceRefId: invoiceAId,
    createdBy: actorId,
  });

  // Redeem 300 of the patient's (now-larger) balance against the SAME invoice A.
  const invoiceAWithRedemption = await billing.applyLoyaltyRedemption(invoiceA.id, { points: 300 }, actorId);
  assert(invoiceAWithRedemption.loyaltyRedemption?.points === 300, 'Invoice A should carry a 300-point redemption');

  const finalizedA = await billing.finalize(invoiceA.id, actorId);
  assert(finalizedA.status === INVOICE_STATUS.FINALIZED, 'Invoice A should finalize');

  const paidA = await billing.recordPayment(invoiceA.id, { amount: finalizedA.total, method: 'CASH' }, actorId);
  assert(paidA.paymentStatus === 'PAID', `Expected invoice A PAID, got ${paidA.paymentStatus}`);
  const payments = await billing.listPayments(invoiceA.id);
  assert(payments.length === 1, 'Expected exactly one payment on invoice A');
  const paymentId = payments[0].id;

  const debitRedeemForA_before = await sumPoints({
    sourceRefType: 'INVOICE',
    sourceRefId: invoiceAId,
    entryType: LOYALTY_ENTRY_TYPE.DEBIT_REDEEM,
  });
  assert(debitRedeemForA_before === 300, `Expected 300 DEBIT_REDEEM points on invoice A, got ${debitRedeemForA_before}`);

  await billing.refund(paymentId, { reason: 'Patient requested full refund', method: 'CASH' }, actorId);

  const clawedForA = await sumPoints({
    sourceRefType: 'INVOICE',
    sourceRefId: invoiceAId,
    entryType: LOYALTY_ENTRY_TYPE.DEBIT_CLAWBACK,
  });
  assert(clawedForA === 1000, `Expected clawback of exactly 1000 EARNED points, got ${clawedForA}`);
  console.log('(7) refund claws back exactly the 1000 EARNED points: PASS');

  const debitRedeemForA_after = await sumPoints({
    sourceRefType: 'INVOICE',
    sourceRefId: invoiceAId,
    entryType: LOYALTY_ENTRY_TYPE.DEBIT_REDEEM,
  });
  assert(
    debitRedeemForA_after === 300,
    `DEBIT_REDEEM points must be untouched by clawback, expected 300, got ${debitRedeemForA_after}`
  );
  console.log('(8) clawback never touches DEBIT_REDEEM entries: PASS');

  // Refunding again (idempotent-ish) must not double-claw already-clawed points.
  let secondRefundRejected = false;
  try {
    await billing.refund(paymentId, { reason: 'duplicate attempt' }, actorId);
  } catch (err) {
    secondRefundRejected = true;
    console.log('(9) re-refunding an already-refunded payment rejected:', err.message);
  }
  assert(secondRefundRejected, 'Refunding an already-refunded payment should be rejected');

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
