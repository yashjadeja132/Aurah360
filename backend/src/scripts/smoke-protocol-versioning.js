/**
 * Ad-hoc smoke test for treatment protocol versioning (Task #37, not part of Vitest).
 *
 * Proves:
 *  1. createNewProtocolVersion() does NOT mutate the old protocol document.
 *  2. A session started before the new version pins protocolVersionSnapshot.version = 1,
 *     and keeps that snapshot after completion — even once v2 exists.
 *  3. A session created/started after the new version pins version = 2.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import TreatmentPlan from '../models/TreatmentPlan.model.js';
import Invoice from '../models/Invoice.model.js';
// Registered only so Mongoose populate() (used by the services under test) can resolve
// these refs — the smoke test itself never creates real Patient/Doctor/Branch documents.
import '../models/Patient.model.js';
import '../models/Doctor.model.js';
import '../models/Branch.model.js';
import '../models/User.model.js';
import TreatmentPlanService from '../services/TreatmentPlanService.js';
import TreatmentSessionService from '../services/TreatmentSessionService.js';
import { TREATMENT_PLAN_STATUS } from '../enums/treatmentPlan.js';
import { generateInvoiceNumber } from '../helpers/invoiceNumber.helper.js';
import { smokeDbUri } from './smokeDbUri.js';

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log('OK:', message);
}

async function main() {
  await mongoose.connect(smokeDbUri(config.mongo.uri, 'aurah360_smoke_protocol_versioning'));
  await mongoose.connection.dropDatabase();

  const planService = new TreatmentPlanService();
  const sessionService = new TreatmentSessionService();

  const patientId = new mongoose.Types.ObjectId();
  const doctorId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();
  const consultationId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();

  // 1. Create protocol v1
  const protocolV1 = await planService.createProtocol(
    {
      name: 'Laser Hair Removal',
      category: 'Laser',
      estimatedSessions: 6,
      items: [
        {
          procedureName: 'Full Face Laser',
          consumables: ['Cooling Gel'],
          preInstructions: 'Avoid sun exposure for 48h',
          postInstructions: 'Apply aloe vera gel',
          parameters: { fluence: 12, pulseWidth: 20 },
        },
      ],
    },
    actorId
  );
  assert(protocolV1.version === 1, `protocol v1 has version 1 (got ${protocolV1.version})`);
  assert(protocolV1.previousVersionId === null, 'protocol v1 has no previousVersionId');

  // 2. Create a treatment plan + invoice + session pinning v1, then complete it.
  const plan = await TreatmentPlan.create({
    planNumber: `TP-SMOKE-${Date.now()}`,
    consultationId,
    patientId,
    doctorId,
    branchId,
    title: 'Laser Plan',
    category: 'Laser',
    estimatedSessions: 6,
    status: TREATMENT_PLAN_STATUS.ACCEPTED,
    protocolId: protocolV1.id,
    items: [{ procedureName: 'Full Face Laser', protocolId: protocolV1.id }],
    createdBy: actorId,
    updatedBy: actorId,
  });

  const invoice = await Invoice.create({
    invoiceNumber: await generateInvoiceNumber(),
    patientId,
    branchId,
    doctorId,
    treatmentPlanId: plan._id,
    items: [
      { itemType: 'SERVICE', description: 'Laser session', quantity: 1, unitPrice: 1000, total: 1000 },
    ],
    subtotal: 1000,
    total: 1000,
    paidAmount: 1000,
    balanceAmount: 0,
    status: 'FINALIZED',
    paymentStatus: 'PAID',
    createdBy: actorId,
    updatedBy: actorId,
  });

  const sessionOld = await sessionService.create(
    { treatmentPlanId: plan._id.toString(), invoiceId: invoice._id.toString() },
    actorId
  );
  const startedOld = await sessionService.start(sessionOld.id, {}, actorId);
  assert(
    startedOld.protocolVersionSnapshot?.version === 1,
    `old session snapshot pins version 1 at start (got ${startedOld.protocolVersionSnapshot?.version})`
  );

  const completedOld = await sessionService.complete(sessionOld.id, {}, actorId);
  assert(completedOld.status === 'COMPLETED', 'old session completed');
  assert(
    completedOld.protocolVersionSnapshot?.version === 1,
    `completed old session still shows snapshot version 1 (got ${completedOld.protocolVersionSnapshot?.version})`
  );

  // 3. Create protocol v2 via the new versioning method — must NOT mutate v1's document.
  const protocolV2 = await planService.createNewProtocolVersion(
    protocolV1.id,
    {
      items: [
        {
          procedureName: 'Full Face Laser',
          consumables: ['Cooling Gel', 'Numbing Cream'],
          preInstructions: 'Avoid sun exposure for 72h',
          postInstructions: 'Apply aloe vera gel twice daily',
          parameters: { fluence: 15, pulseWidth: 25 },
        },
      ],
      estimatedSessions: 8,
    },
    actorId
  );
  assert(protocolV2.version === 2, `new protocol document has version 2 (got ${protocolV2.version})`);
  assert(
    protocolV2.previousVersionId === protocolV1.id,
    'new protocol document points previousVersionId at v1'
  );
  assert(protocolV2.approvedBy === null && protocolV2.approvedAt === null, 'new version requires re-approval (approvedBy/approvedAt reset)');
  assert(protocolV2.id !== protocolV1.id, 'v2 is a distinct document from v1');

  const protocolV1AfterVersioning = await planService.getProtocol(protocolV1.id);
  assert(protocolV1AfterVersioning.version === 1, 'old protocol document version is still 1 (not mutated)');
  assert(
    protocolV1AfterVersioning.items[0].consumables.length === 1,
    'old protocol document consumables list unchanged'
  );
  assert(
    protocolV1AfterVersioning.items[0].preInstructions === 'Avoid sun exposure for 48h',
    'old protocol document preInstructions unchanged'
  );
  assert(
    protocolV1AfterVersioning.estimatedSessions === 6,
    'old protocol document estimatedSessions unchanged'
  );

  // Re-check the already-completed session's snapshot is still untouched after v2 exists.
  const oldSessionRecheck = await sessionService.getById(sessionOld.id);
  assert(
    oldSessionRecheck.protocolVersionSnapshot?.version === 1,
    `old completed session snapshot STILL shows version 1 after v2 was created (got ${oldSessionRecheck.protocolVersionSnapshot?.version})`
  );

  // 4. A new session created/started after v2 exists (plan repointed at protocolV2) pins version 2.
  await planService.applyProtocol(plan._id.toString(), protocolV2.id, actorId).catch(() => {
    // applyProtocol requires an editable/DRAFT-ish plan + real consultation; ACCEPTED plans
    // can't go through it. Fall back to a direct repository update for the smoke test.
  });
  await TreatmentPlan.updateOne({ _id: plan._id }, { $set: { protocolId: protocolV2.id } });

  const sessionNew = await sessionService.create(
    { treatmentPlanId: plan._id.toString(), invoiceId: invoice._id.toString() },
    actorId
  );
  const startedNew = await sessionService.start(sessionNew.id, {}, actorId);
  assert(
    startedNew.protocolVersionSnapshot?.version === 2,
    `new session started after v2 pins version 2 (got ${startedNew.protocolVersionSnapshot?.version})`
  );

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch(async (err) => {
  console.error('SMOKE FAIL', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* noop */
  }
  process.exit(1);
});
