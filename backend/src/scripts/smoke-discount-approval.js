/** Ad-hoc smoke test for discount-approval gating on invoice finalize (not part of Vitest). */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import '../models/index.js'; // registers every model so populate() paths resolve
import Branch from '../models/Branch.model.js';
import Patient from '../models/Patient.model.js';
import BillingService from '../services/BillingService.js';
import { DISCOUNT_TYPE } from '../enums/billing.js';
import { smokeDbUri } from './smokeDbUri.js';

async function main() {
  await mongoose.connect(smokeDbUri(config.mongo.uri, 'aurah360_smoke_discount'));
  await mongoose.connection.dropDatabase();

  const branch = await Branch.create({
    name: 'Discount Smoke Branch',
    branchCode: `DSB-${Date.now()}`,
    displayName: 'Discount Smoke Branch',
    email: `discount-smoke-${Date.now()}@example.com`,
    phone: '9800000000',
  });

  const patient = await Patient.create({
    mrn: `MRN-DISC-${Date.now()}`,
    firstName: 'Discount',
    lastName: 'Smoke',
    gender: 'MALE',
    mobile: '9811111111',
    primaryBranchId: branch._id,
  });

  const actorId = new mongoose.Types.ObjectId();
  const billing = new BillingService();

  console.log(
    'Configured threshold percent:',
    config.billing.discountApprovalThresholdPercent
  );

  // (a) Small discount (well under threshold) finalizes fine.
  const smallInvoice = await billing.create(
    {
      patientId: patient._id.toString(),
      branchId: branch._id.toString(),
      items: [{ description: 'Consultation', quantity: 1, unitPrice: 1000, discount: 0 }],
      discountType: DISCOUNT_TYPE.PERCENTAGE,
      discountValue: 5, // 5% — under the default 20% threshold
    },
    actorId
  );
  if (smallInvoice.discountApprovalRequired) {
    throw new Error('Small discount should NOT require approval');
  }
  const finalizedSmall = await billing.finalize(smallInvoice.id, actorId);
  if (finalizedSmall.status !== 'FINALIZED') throw new Error('Small-discount invoice should finalize');
  console.log('(a) small discount finalizes fine: PASS');

  // Caller cannot set discountApprovalRequired/discountApproved directly.
  const bypassAttempt = await billing.create(
    {
      patientId: patient._id.toString(),
      branchId: branch._id.toString(),
      items: [{ description: 'Consultation', quantity: 1, unitPrice: 1000, discount: 0 }],
      discountType: DISCOUNT_TYPE.PERCENTAGE,
      discountValue: 50, // over threshold
      discountReason: 'Corporate tie-up rate',
      discountApprovalRequired: false, // attempted bypass — must be ignored
      discountApproved: true, // attempted bypass — must be ignored
      discountApprovalStatus: 'APPROVED', // attempted bypass — must be ignored
    },
    actorId
  );
  if (
    !bypassAttempt.discountApprovalRequired ||
    bypassAttempt.discountApproved ||
    bypassAttempt.discountApprovalStatus !== 'PENDING_APPROVAL'
  ) {
    throw new Error('Caller-supplied discount approval flags must be ignored');
  }
  console.log('caller cannot bypass approval flags on create: PASS');

  // An above-threshold discount with NO reason must be refused outright.
  try {
    await billing.create(
      {
        patientId: patient._id.toString(),
        branchId: branch._id.toString(),
        items: [{ description: 'Package', quantity: 1, unitPrice: 1000, discount: 0 }],
        discountType: DISCOUNT_TYPE.PERCENTAGE,
        discountValue: 40,
      },
      actorId
    );
    throw new Error('Above-threshold discount without a reason should have been rejected!');
  } catch (err) {
    if (err.message.startsWith('Above-threshold discount without a reason')) throw err;
    console.log('above-threshold discount without a reason rejected: PASS —', err.message);
  }

  // (b) Large discount (over threshold) blocks finalize until approved.
  const bigInvoice = await billing.create(
    {
      patientId: patient._id.toString(),
      branchId: branch._id.toString(),
      items: [{ description: 'Package', quantity: 1, unitPrice: 1000, discount: 0 }],
      discountType: DISCOUNT_TYPE.PERCENTAGE,
      discountValue: 50, // 50% — over the default 20% threshold
      discountReason: 'Long-standing patient goodwill',
    },
    actorId
  );
  if (bigInvoice.discountApprovalStatus !== 'PENDING_APPROVAL') {
    throw new Error(
      `Large discount should sit PENDING_APPROVAL, got ${bigInvoice.discountApprovalStatus}`
    );
  }
  if (!bigInvoice.discountApprovalRequired) {
    throw new Error('Large discount should require approval');
  }
  if (bigInvoice.discountApproved) {
    throw new Error('Large discount should not be pre-approved');
  }

  try {
    await billing.finalize(bigInvoice.id, actorId);
    throw new Error('Finalize should have been blocked for unapproved large discount!');
  } catch (err) {
    if (err.message === 'Finalize should have been blocked for unapproved large discount!') throw err;
    console.log('(b) large discount blocks finalize: PASS —', err.message);
  }

  // (d) Approving without a reason is rejected.
  try {
    await billing.approveDiscount(bigInvoice.id, {}, actorId);
    throw new Error('Approval without a reason should have been rejected!');
  } catch (err) {
    if (err.message === 'Approval without a reason should have been rejected!') throw err;
    console.log('(d) approval without reason rejected: PASS —', err.message);
  }

  // (c) Approving with a reason then allows finalize.
  const approved = await billing.approveDiscount(
    bigInvoice.id,
    { reason: 'Loyal patient goodwill discount approved by branch manager' },
    actorId
  );
  if (!approved.discountApproved) throw new Error('Invoice should be marked discountApproved');

  const finalizedBig = await billing.finalize(bigInvoice.id, actorId);
  if (finalizedBig.status !== 'FINALIZED') {
    throw new Error('Approved large-discount invoice should finalize');
  }
  console.log('(c) approving with reason then allows finalize: PASS');

  // (e) Reject path — a rejected discount keeps finalize blocked, with the rejection surfaced.
  const rejectedInvoice = await billing.create(
    {
      patientId: patient._id.toString(),
      branchId: branch._id.toString(),
      items: [{ description: 'Package', quantity: 1, unitPrice: 1000, discount: 0 }],
      discountType: DISCOUNT_TYPE.PERCENTAGE,
      discountValue: 60,
      discountReason: 'Patient asked for a bigger cut',
    },
    actorId
  );
  const afterReject = await billing.rejectDiscount(
    rejectedInvoice.id,
    { decisionNote: 'Too deep for this service — cap at 20%' },
    actorId
  );
  if (afterReject.discountApprovalStatus !== 'REJECTED' || afterReject.discountApproved) {
    throw new Error('Rejected discount should be REJECTED and not approved');
  }
  try {
    await billing.finalize(rejectedInvoice.id, actorId);
    throw new Error('Finalize should have been blocked for a rejected discount!');
  } catch (err) {
    if (err.message.startsWith('Finalize should have been blocked for a rejected')) throw err;
    console.log('(e) rejected discount keeps finalize blocked: PASS —', err.message);
  }

  // Editing the discount back under the threshold clears the gate entirely.
  const reduced = await billing.updateDraft(
    rejectedInvoice.id,
    { discountType: DISCOUNT_TYPE.PERCENTAGE, discountValue: 10 },
    actorId
  );
  if (reduced.discountApprovalStatus !== 'NOT_REQUIRED') {
    throw new Error(`Reduced discount should be NOT_REQUIRED, got ${reduced.discountApprovalStatus}`);
  }
  const finalizedReduced = await billing.finalize(rejectedInvoice.id, actorId);
  if (finalizedReduced.status !== 'FINALIZED') {
    throw new Error('Invoice reduced under threshold should finalize');
  }
  console.log('(f) reducing the discount under threshold clears the gate: PASS');

  // The queue lists what is genuinely pending — nothing here, everything above was decided.
  const queue = await billing.listDiscountApprovalQueue({});
  if (queue.items.some((i) => i.discountApprovalStatus !== 'PENDING_APPROVAL')) {
    throw new Error('Queue must only contain PENDING_APPROVAL invoices');
  }
  console.log(`(g) pending queue returns ${queue.items.length} pending invoice(s): PASS`);

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
