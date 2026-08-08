/** Ad-hoc smoke test for the APP-006 dependent-switching backend pieces (not part of Vitest). */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import Patient from '../models/Patient.model.js';
import PatientPortalService from '../services/PatientPortalService.js';
import { smokeDbUri } from './smokeDbUri.js';

async function main() {
  await mongoose.connect(smokeDbUri(config.mongo.uri, 'aurah360_smoke_dependents'));
  await mongoose.connection.dropDatabase();

  const branchId = new mongoose.Types.ObjectId();

  const guardian = await Patient.create({
    mrn: `MRN-GUARD-${Date.now()}`,
    firstName: 'Guardian',
    lastName: 'Smoke',
    gender: 'FEMALE',
    mobile: '9812345000',
    portalEnabled: true,
    primaryBranchId: branchId,
  });

  const dependent = await Patient.create({
    mrn: `MRN-DEP-${Date.now()}`,
    firstName: 'Dependent',
    lastName: 'Smoke',
    gender: 'MALE',
    dateOfBirth: new Date('2015-01-01'),
    mobile: guardian.mobile,
    primaryBranchId: branchId,
    isDependent: true,
    guardianPatientId: guardian._id,
    guardianName: `${guardian.firstName} ${guardian.lastName}`,
    guardianRelationship: 'Son',
    guardianVerified: true,
  });

  const otherGuardian = await Patient.create({
    mrn: `MRN-OTHER-${Date.now()}`,
    firstName: 'Other',
    lastName: 'Guardian',
    gender: 'MALE',
    mobile: '9812345999',
    primaryBranchId: branchId,
  });

  const portal = new PatientPortalService();

  const list = await portal.listDependents(guardian._id.toString());
  console.log('listDependents:', JSON.stringify(list, null, 2));
  if (list.length !== 1) throw new Error('Expected exactly 1 dependent');
  if (list[0].id !== dependent._id.toString()) throw new Error('Dependent id mismatch');
  if (list[0].relationship !== 'Son') throw new Error('Relationship mismatch');

  const emptyList = await portal.listDependents(dependent._id.toString());
  if (emptyList.length !== 0) throw new Error('Dependent should have no dependents of its own');

  const dash = await portal.dependentDashboard(guardian._id.toString(), dependent._id.toString());
  console.log('dependentDashboard keys:', Object.keys(dash));
  if (!dash.dependent || dash.dependent.id !== dependent._id.toString()) {
    throw new Error('dependentDashboard did not scope to the dependent');
  }
  if (dash.dependent.relationship !== 'Son') throw new Error('dependentDashboard relationship mismatch');
  if (!('upcomingAppointments' in dash)) throw new Error('dependentDashboard missing dashboard fields');

  try {
    await portal.dependentDashboard(otherGuardian._id.toString(), dependent._id.toString());
    throw new Error('A non-guardian should not be able to view the dependent dashboard!');
  } catch (err) {
    if (err.message.includes('should not be able')) throw err;
    console.log('Non-guardian correctly rejected:', err.message);
  }

  try {
    await portal.dependentDashboard(guardian._id.toString(), otherGuardian._id.toString());
    throw new Error('A non-dependent patient should not be accessible as a dependent!');
  } catch (err) {
    if (err.message.includes('should not be accessible')) throw err;
    console.log('Non-dependent patient correctly rejected:', err.message);
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
