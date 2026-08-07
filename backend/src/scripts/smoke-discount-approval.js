/** Ad-hoc smoke test for discount-approval gating on invoice finalize (not part of Vitest). */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import '../models/index.js'; // registers every model so populate() paths resolve
import Branch from '../models/Branch.model.js';
import Patient from '../models/Patient.model.js';
import BillingService from '../services/BillingService.js';
import { DISCOUNT_TYPE } from '../enums/billing.js';

async function main() {
  await mongoose.connect(config.mongo.uri.replace(/\/([^/?]+)$/, '/aurah360_smoke_discount'));
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
      discountApprovalRequired: false, // attempted bypass — must be ignored
      discountApproved: true, // attempted bypass — must be ignored
    },
    actorId
  );
  if (!bypassAttempt.discountApprovalRequired || bypassAttempt.discountApproved) {
    throw new Error('Caller-supplied discount approval flags must be ignored');
  }
  console.log('caller cannot bypass approval flags on create: PASS');

  // (b) Large discount (over threshold) blocks finalize until approved.
  const bigInvoice = await billing.create(
    {
      patientId: patient._id.toString(),
      branchId: branch._id.toString(),
      items: [{ description: 'Package', quantity: 1, unitPrice: 1000, discount: 0 }],
      discountType: DISCOUNT_TYPE.PERCENTAGE,
      discountValue: 50, // 50% — over the default 20% threshold
    },
    actorId
  );
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

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
