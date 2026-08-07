/** Ad-hoc smoke test for patient-submitted privacy requests (Task #51, not part of Vitest). */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import Patient from '../models/Patient.model.js';
import PatientPortalService from '../services/PatientPortalService.js';
import { PRIVACY_REQUEST_TYPE } from '../enums/privacy.js';

async function main() {
  await mongoose.connect(config.mongo.uri.replace(/\/([^/?]+)$/, '/aurah360_smoke_privacy'));
  await mongoose.connection.dropDatabase();

  const patientA = await Patient.create({
    mrn: `MRN-PRIV-A-${Date.now()}`,
    firstName: 'Alice',
    lastName: 'Smoke',
    gender: 'FEMALE',
    mobile: '9812345671',
    portalEnabled: true,
    primaryBranchId: new mongoose.Types.ObjectId(),
  });

  const patientB = await Patient.create({
    mrn: `MRN-PRIV-B-${Date.now()}`,
    firstName: 'Bob',
    lastName: 'Smoke',
    gender: 'MALE',
    mobile: '9812345672',
    portalEnabled: true,
    primaryBranchId: new mongoose.Types.ObjectId(),
  });

  const portal = new PatientPortalService();

  const created = await portal.submitPrivacyRequest(patientA._id.toString(), {
    requestType: PRIVACY_REQUEST_TYPE.ACCESS,
    details: 'Please send me a copy of all my records.',
  });
  console.log('submitPrivacyRequest:', created);

  if (!created.id) throw new Error('Created request missing id');
  if (created.status !== 'OPEN') throw new Error(`Expected status OPEN, got ${created.status}`);
  if (created.type !== PRIVACY_REQUEST_TYPE.ACCESS) throw new Error('Type mismatch');

  // Patient B submits their own, unrelated request.
  await portal.submitPrivacyRequest(patientB._id.toString(), {
    requestType: PRIVACY_REQUEST_TYPE.ERASURE,
    details: 'Please delete my marketing data.',
  });

  const listA = await portal.listPrivacyRequests(patientA._id.toString());
  console.log('listPrivacyRequests (A):', listA);
  if (listA.items.length !== 1) throw new Error(`Expected 1 request for patient A, got ${listA.items.length}`);
  if (listA.items[0].id !== created.id) throw new Error('Patient A did not see their own request');

  const listB = await portal.listPrivacyRequests(patientB._id.toString());
  if (listB.items.length !== 1) throw new Error(`Expected 1 request for patient B, got ${listB.items.length}`);

  // Cross-check: patient A's request must never appear in patient B's list.
  const leaked = listB.items.find((r) => r.id === created.id);
  if (leaked) throw new Error('Patient A request leaked into patient B list!');

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
