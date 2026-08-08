/** Ad-hoc smoke test for the mandatory reason on BillingService.voidDraft (not part of Vitest). */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import '../models/index.js'; // registers every model so populate() paths resolve
import Branch from '../models/Branch.model.js';
import Patient from '../models/Patient.model.js';
import AuditLog from '../models/AuditLog.model.js';
import BillingService from '../services/BillingService.js';
import { smokeDbUri } from './smokeDbUri.js';

async function main() {
  await mongoose.connect(smokeDbUri(config.mongo.uri, 'aurah360_smoke_void_reason'));
  await mongoose.connection.dropDatabase();

  const branch = await Branch.create({
    name: 'Void Reason Smoke Branch',
    branchCode: `VRB-${Date.now()}`,
    displayName: 'Void Reason Smoke Branch',
    email: `void-reason-smoke-${Date.now()}@example.com`,
    phone: '9800000001',
  });

  const patient = await Patient.create({
    mrn: `MRN-VOID-${Date.now()}`,
    firstName: 'Void',
    lastName: 'Smoke',
    gender: 'MALE',
    mobile: '9811111112',
    primaryBranchId: branch._id,
  });

  const actorId = new mongoose.Types.ObjectId();
  const billing = new BillingService();

  const invoice = await billing.create(
    {
      patientId: patient._id.toString(),
      branchId: branch._id.toString(),
      items: [{ description: 'Consultation', quantity: 1, unitPrice: 1000, discount: 0 }],
    },
    actorId
  );

  // (a) Voiding without a reason is rejected.
  try {
    await billing.voidDraft(invoice.id, {}, actorId);
    throw new Error('Void without a reason should have been rejected!');
  } catch (err) {
    if (err.message === 'Void without a reason should have been rejected!') throw err;
    console.log('(a) void without reason rejected: PASS —', err.message);
  }

  try {
    await billing.voidDraft(invoice.id, { reason: '   ' }, actorId);
    throw new Error('Void with a blank reason should have been rejected!');
  } catch (err) {
    if (err.message === 'Void with a blank reason should have been rejected!') throw err;
    console.log('(a2) void with blank reason rejected: PASS —', err.message);
  }

  // (b) Voiding with a reason succeeds and the reason is recorded on the timeline/audit log.
  const REASON = 'Patient requested cancellation before treatment started';
  const voided = await billing.voidDraft(invoice.id, { reason: REASON }, actorId);

  if (voided.status !== 'VOID') throw new Error('Invoice should be VOID after voidDraft');

  const timelineEntry = voided.timeline?.find((t) => t.action === 'VOIDED');
  if (!timelineEntry) throw new Error('Timeline should contain a VOIDED entry');
  if (timelineEntry.note !== REASON) {
    throw new Error(`Timeline note should be the reason, got: ${timelineEntry.note}`);
  }
  console.log('(b) timeline records the real reason: PASS');

  const auditEntry = await AuditLog.findOne({ action: 'INVOICE_VOIDED', actorId }).lean();
  if (!auditEntry) throw new Error('Audit log entry for INVOICE_VOIDED not found');
  if (auditEntry.metadata?.reason !== REASON) {
    throw new Error(`Audit log metadata.reason mismatch, got: ${auditEntry.metadata?.reason}`);
  }
  console.log('(b2) audit log records the real reason: PASS');

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
