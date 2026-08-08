/**
 * Ad-hoc smoke test for TreatmentSessionService.complete() side effects (not part of Vitest):
 *  - decrements the parent TreatmentPlan's packageSnapshot.unusedSessions by exactly 1
 *  - deducts real inventory stock for consumables used, recording a StockTransaction
 * Isolated DB, self-cleaning — mirrors smoke-otp-login.js's style.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import '../models/index.js'; // registers every model so populate() paths resolve
import TreatmentPlan from '../models/TreatmentPlan.model.js';
import Invoice from '../models/Invoice.model.js';
import TreatmentSessionService from '../services/TreatmentSessionService.js';
import InventoryService from '../services/InventoryService.js';
import { TREATMENT_PLAN_STATUS } from '../enums/treatmentPlan.js';
import { PAYMENT_STATUS, INVOICE_STATUS } from '../enums/billing.js';
import { STOCK_TX_TYPE } from '../enums/inventory.js';
import { smokeDbUri } from './smokeDbUri.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  await mongoose.connect(smokeDbUri(config.mongo.uri, 'aurah360_smoke_session_complete'));
  await mongoose.connection.dropDatabase();

  const branchId = new mongoose.Types.ObjectId();
  const patientId = new mongoose.Types.ObjectId();
  const doctorId = new mongoose.Types.ObjectId();
  const consultationId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();

  // Invoice must exist, match the plan's patient, and be Paid/Partial for the payment gate.
  const invoice = await Invoice.create({
    invoiceNumber: `INV-SMOKE-${Date.now()}`,
    patientId,
    branchId,
    doctorId,
    status: INVOICE_STATUS.FINALIZED,
    paymentStatus: PAYMENT_STATUS.PAID,
    total: 5000,
    paidAmount: 5000,
    balanceAmount: 0,
  });

  // Treatment plan booked against a 5-session package.
  const plan = await TreatmentPlan.create({
    planNumber: `TPN-SMOKE-${Date.now()}`,
    consultationId,
    patientId,
    doctorId,
    branchId,
    title: 'Smoke package plan',
    status: TREATMENT_PLAN_STATUS.ACCEPTED,
    estimatedSessions: 5,
    packageSnapshot: {
      packageId: new mongoose.Types.ObjectId(),
      packageName: 'Smoke Package',
      packagePrice: 5000,
      discount: 0,
      validityDays: 90,
      maximumSessions: 5,
      unusedSessions: 5,
    },
  });

  // Inventory item that will be matched by name against the session's consumable.
  const inventoryService = new InventoryService();
  const item = await inventoryService.createItem(
    {
      name: 'Smoke Consumable Gel',
      itemType: 'CONSUMABLE',
      branchId: branchId.toString(),
      minimumStock: 1,
      reorderLevel: 1,
    },
    actorId.toString()
  );
  await inventoryService.openingStock(
    {
      inventoryItemId: item.id,
      quantity: 10,
      batchNumber: 'SMOKE-BATCH-1',
    },
    actorId.toString()
  );
  const itemBefore = await inventoryService.getItem(item.id);
  assert(itemBefore.currentStock === 10, `Expected opening stock 10, got ${itemBefore.currentStock}`);

  const sessionService = new TreatmentSessionService();

  const session = await sessionService.create(
    {
      treatmentPlanId: plan._id.toString(),
      invoiceId: invoice._id.toString(),
    },
    actorId.toString()
  );
  assert(session.id, 'Session creation failed');
  console.log('created session', session.sessionNumber);

  await sessionService.start(session.id, {}, actorId.toString());
  console.log('started session');

  const completed = await sessionService.complete(
    session.id,
    { consumables: ['Smoke Consumable Gel'] },
    actorId.toString()
  );
  assert(completed.status === 'COMPLETED', `Expected COMPLETED, got ${completed.status}`);
  console.log('completed session');

  // --- Assertion 1: package balance decremented by exactly 1 ---
  const planAfter = await TreatmentPlan.findById(plan._id).exec();
  assert(
    planAfter.packageSnapshot.unusedSessions === 4,
    `Expected unusedSessions to drop from 5 to 4, got ${planAfter.packageSnapshot.unusedSessions}`
  );
  console.log('✓ packageSnapshot.unusedSessions decremented by exactly 1 (5 -> 4)');

  // --- Assertion 2: inventory stock deducted + a StockTransaction recorded ---
  const itemAfter = await inventoryService.getItem(item.id);
  assert(
    itemAfter.currentStock === 9,
    `Expected currentStock to drop from 10 to 9, got ${itemAfter.currentStock}`
  );
  console.log('✓ inventory stock deducted by exactly 1 (10 -> 9)');

  const ledger = await inventoryService.ledger({ inventoryItemId: item.id });
  const consumptionTx = ledger.items.find(
    (t) => t.type === STOCK_TX_TYPE.CONSUMPTION && t.referenceId === session.id
  );
  assert(consumptionTx, `Expected a CONSUMPTION StockTransaction referencing the session, ledger=${JSON.stringify(ledger.items)}`);
  console.log('✓ StockTransaction recorded for consumable usage:', consumptionTx.transactionNumber);

  // --- Double-completion guard: calling complete() again must fail, not double-decrement ---
  let secondCompleteRejected = false;
  try {
    await sessionService.complete(session.id, {}, actorId.toString());
  } catch (err) {
    secondCompleteRejected = true;
    console.log('✓ second complete() call correctly rejected:', err.message);
  }
  assert(secondCompleteRejected, 'complete() should reject an already-completed session');

  const planAfterSecondAttempt = await TreatmentPlan.findById(plan._id).exec();
  assert(
    planAfterSecondAttempt.packageSnapshot.unusedSessions === 4,
    `unusedSessions must stay at 4 after a rejected second complete(), got ${planAfterSecondAttempt.packageSnapshot.unusedSessions}`
  );
  console.log('✓ no double-decrement on repeated complete() calls');

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
