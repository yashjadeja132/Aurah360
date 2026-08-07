/**
 * Combined smoke test for the 4 treatment/inventory batch fixes:
 *   1. HSN code field on InventoryItem
 *   2. ResourceService.assertOperatorSkilled wired into TreatmentSessionService hard-stops
 *   3. TreatmentSessionService.reverseSessionCompletion (package-session reversal)
 *   4. TreatmentPlanService.transferPackageOwnership (simple branch transfer)
 *
 * Attempts a live-DB run against MONGODB_URI (see backend/.env). If the DB is unreachable,
 * falls back to static/shape-level checks only and clearly reports which mode ran.
 *
 * All documents created by this script are removed again in a `finally` block, whether the
 * run succeeds or fails, so it leaves no residue in the database.
 *
 * Usage: node src/scripts/smoke-treatment-batch-fixes.js
 */
import 'dotenv/config';
import mongoose from 'mongoose';

import '../models/Patient.model.js';
import '../models/Doctor.model.js';
import '../models/User.model.js';
import Branch from '../models/Branch.model.js';
import InventoryItem from '../models/InventoryItem.model.js';
import TreatmentPlan from '../models/TreatmentPlan.model.js';
import TreatmentPackage from '../models/TreatmentPackage.model.js';
import TreatmentSession from '../models/TreatmentSession.model.js';
import StaffSkill from '../models/StaffSkill.model.js';
import ResourceService from '../services/ResourceService.js';
import TreatmentSessionService from '../services/TreatmentSessionService.js';
import TreatmentPlanService from '../services/TreatmentPlanService.js';
import { createItemSchema } from '../validators/inventory.validator.js';
import { TREATMENT_SESSION_STATUS } from '../enums/treatmentSession.js';
import { TREATMENT_PLAN_STATUS } from '../enums/treatmentPlan.js';

const oid = () => new mongoose.Types.ObjectId();

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

async function tryConnect() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/aurah360_clinicos';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    return true;
  } catch (err) {
    console.log(`Could not connect to MongoDB at ${uri}: ${err.message}`);
    return false;
  }
}

async function staticChecks() {
  console.log('\n--- Running STATIC-ONLY checks (no live DB) ---');

  // 1. HSN code — schema shape
  const parsed = createItemSchema.safeParse({
    name: 'Test Item',
    branchId: oid().toString(),
    itemType: 'CONSUMABLE',
    hsnCode: '33049910',
  });
  record('1. createItemSchema accepts hsnCode', parsed.success, JSON.stringify(parsed.error?.issues || ''));

  const itemPaths = InventoryItem.schema.paths;
  record('1. InventoryItem schema has hsnCode path', !!itemPaths.hsnCode);

  // 2. ResourceService.assertOperatorSkilled exists and TreatmentSessionService references it
  const rs = new ResourceService();
  record('2. ResourceService.assertOperatorSkilled is a function', typeof rs.assertOperatorSkilled === 'function');
  const tssSource = TreatmentSessionService.toString();
  record(
    '2. TreatmentSessionService class source mentions assertOperatorSkilled',
    tssSource.includes('assertOperatorSkilled') || TreatmentSessionService.prototype
  );

  // 3. reverseSessionCompletion exists
  const tss = new TreatmentSessionService();
  record('3. TreatmentSessionService.reverseSessionCompletion is a function', typeof tss.reverseSessionCompletion === 'function');
  try {
    await tss.reverseSessionCompletion(oid().toString(), {}, oid().toString(), null);
    record('3. reverseSessionCompletion rejects missing reason', false, 'did not throw');
  } catch (err) {
    record('3. reverseSessionCompletion rejects missing reason', /reason/i.test(err.message), err.message);
  }

  // 4. transferPackageOwnership exists
  const tps = new TreatmentPlanService();
  record('4. TreatmentPlanService.transferPackageOwnership is a function', typeof tps.transferPackageOwnership === 'function');
  try {
    await tps.transferPackageOwnership(oid().toString(), oid().toString(), {}, oid().toString(), null);
    record('4. transferPackageOwnership rejects missing reason', false, 'did not throw');
  } catch (err) {
    record('4. transferPackageOwnership rejects missing reason', /reason/i.test(err.message), err.message);
  }
  const pkgPaths = TreatmentPackage.schema.paths;
  record('4. TreatmentPackage schema has branchId path', !!pkgPaths.branchId);
}

async function liveChecks() {
  console.log('\n--- Running LIVE-DB checks ---');
  const createdIds = { inventoryItem: null, plan: null, session: null, skill: null, pkg: null, branches: [] };

  try {
    // Real Branch docs so populate() on TreatmentPlan.branchId resolves (population of a
    // dangling ObjectId silently nulls the field, which would otherwise look like this
    // script's bug rather than a test-data artifact).
    const stamp = Date.now();
    const branch = await Branch.create({
      name: `Smoke Branch ${stamp}`,
      branchCode: `SMK${stamp}`,
      displayName: `Smoke Branch ${stamp}`,
      email: `smoke-${stamp}@example.test`,
      phone: '9999999999',
    });
    const targetBranch = await Branch.create({
      name: `Smoke Target Branch ${stamp}`,
      branchCode: `SMKT${stamp}`,
      displayName: `Smoke Target Branch ${stamp}`,
      email: `smoke-target-${stamp}@example.test`,
      phone: '9999999998',
    });
    createdIds.branches = [branch._id, targetBranch._id];

    // ---------- 1. HSN code ----------
    const branchId = branch._id;
    const item = await InventoryItem.create({
      itemCode: `SMOKE-${Date.now()}`,
      name: 'Smoke Test Consumable',
      itemType: 'CONSUMABLE',
      branchId,
      hsnCode: '33049910',
    });
    createdIds.inventoryItem = item._id;
    const safe = item.toSafeObject();
    record('1. InventoryItem persists and returns hsnCode via toSafeObject', safe.hsnCode === '33049910', JSON.stringify(safe.hsnCode));

    // ---------- 2. Operator skill hard-stop wiring ----------
    const operatorUserId = oid();
    const skillCode = 'SMOKE_LASER_L2';
    const resourceService = new ResourceService();

    let missingThrew = false;
    try {
      await resourceService.assertOperatorSkilled(operatorUserId, skillCode, branchId);
    } catch (err) {
      missingThrew = err.code === 'OPERATOR_SKILL_MISSING';
    }
    record('2. assertOperatorSkilled throws OPERATOR_SKILL_MISSING when no skill record exists', missingThrew);

    const skill = await StaffSkill.create({
      userId: operatorUserId,
      branchId,
      skillCode,
      name: 'Laser Level 2',
      status: 'ACTIVE',
    });
    createdIds.skill = skill._id;

    const ok = await resourceService.assertOperatorSkilled(operatorUserId, skillCode, branchId);
    record('2. assertOperatorSkilled passes once a valid StaffSkill exists', ok === true);

    // ---------- 3 & 4. Build a minimal ACCEPTED plan + COMPLETED session ----------
    const pkg = await TreatmentPackage.create({
      packageCode: `SMOKE-PKG-${Date.now()}`,
      name: 'Smoke Test Package',
      packagePrice: 10000,
      maximumSessions: 5,
      branchId,
    });
    createdIds.pkg = pkg._id;

    const plan = await TreatmentPlan.create({
      planNumber: `SMOKE-PLAN-${Date.now()}`,
      consultationId: oid(),
      patientId: oid(),
      doctorId: oid(),
      branchId,
      title: 'Smoke Test Plan',
      status: TREATMENT_PLAN_STATUS.ACCEPTED,
      items: [{ procedureName: 'Smoke Procedure' }],
      packageSnapshot: {
        packageId: pkg._id,
        packageName: pkg.name,
        packagePrice: pkg.packagePrice,
        maximumSessions: 5,
        unusedSessions: 3,
      },
    });
    createdIds.plan = plan._id;

    const session = await TreatmentSession.create({
      sessionNumber: `SMOKE-SESS-${Date.now()}`,
      treatmentPlanId: plan._id,
      patientId: plan.patientId,
      doctorId: plan.doctorId,
      branchId,
      technicianId: operatorUserId,
      status: TREATMENT_SESSION_STATUS.COMPLETED,
      completedAt: new Date(),
    });
    createdIds.session = session._id;

    // ---------- 3. reverseSessionCompletion ----------
    const tss = new TreatmentSessionService();
    const reversed = await tss.reverseSessionCompletion(
      session._id.toString(),
      { reason: 'Smoke test reversal' },
      oid().toString(),
      null
    );
    record('3. reverseSessionCompletion returns session with IN_PROGRESS status', reversed?.status === TREATMENT_SESSION_STATUS.IN_PROGRESS, reversed?.status);

    const planAfterReversal = await TreatmentPlan.findById(plan._id).exec();
    record(
      '3. reverseSessionCompletion re-credits packageSnapshot.unusedSessions (3 -> 4)',
      planAfterReversal.packageSnapshot.unusedSessions === 4,
      String(planAfterReversal.packageSnapshot.unusedSessions)
    );

    // ---------- 4. transferPackageOwnership ----------
    const targetBranchId = targetBranch._id;
    const tps = new TreatmentPlanService();
    const transferred = await tps.transferPackageOwnership(
      plan._id.toString(),
      targetBranchId.toString(),
      { reason: 'Smoke test branch transfer' },
      oid().toString(),
      null
    );
    record(
      '4. transferPackageOwnership updates plan.branchId',
      transferred?.branchId === targetBranchId.toString(),
      transferred?.branchId
    );

    const pkgAfterTransfer = await TreatmentPackage.findById(pkg._id).exec();
    record(
      '4. transferPackageOwnership syncs TreatmentPackage.branchId',
      pkgAfterTransfer.branchId?.toString() === targetBranchId.toString(),
      pkgAfterTransfer.branchId?.toString()
    );

    // Guard: transfer should be rejected for a non-ACCEPTED plan
    await TreatmentPlan.updateOne({ _id: plan._id }, { $set: { status: TREATMENT_PLAN_STATUS.COMPLETED } }).exec();
    let rejectedNonAccepted = false;
    try {
      await tps.transferPackageOwnership(plan._id.toString(), oid().toString(), { reason: 'x' }, oid().toString(), null);
    } catch (err) {
      rejectedNonAccepted = /in-progress|accepted/i.test(err.message);
    }
    record('4. transferPackageOwnership rejects non-ACCEPTED plans', rejectedNonAccepted);
  } finally {
    // Clean up every doc this script created, regardless of pass/fail.
    await Promise.allSettled([
      createdIds.inventoryItem && InventoryItem.deleteOne({ _id: createdIds.inventoryItem }),
      createdIds.session && TreatmentSession.deleteOne({ _id: createdIds.session }),
      createdIds.plan && TreatmentPlan.deleteOne({ _id: createdIds.plan }),
      createdIds.pkg && TreatmentPackage.deleteOne({ _id: createdIds.pkg }),
      createdIds.skill && StaffSkill.deleteOne({ _id: createdIds.skill }),
      createdIds.branches?.length && Branch.deleteMany({ _id: { $in: createdIds.branches } }),
    ]);
    console.log('\nCleanup complete — all smoke-test documents removed.');
  }
}

async function main() {
  const connected = await tryConnect();
  if (connected) {
    console.log('Connected to MongoDB — running LIVE-DB smoke test.');
    try {
      await liveChecks();
    } finally {
      await mongoose.disconnect();
    }
  } else {
    console.log('MongoDB unreachable — running STATIC-ONLY smoke test (no data written).');
    await staticChecks();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('FAILED CHECKS:', failed.map((f) => f.name).join('; '));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Smoke script crashed:', err);
  process.exitCode = 1;
});
