/** Ad-hoc smoke test for Task #33 dependent-scoped appointments/invoices/documents/
 * treatment-plans (not part of Vitest). */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import Patient from '../models/Patient.model.js';
import PatientPortalService from '../services/PatientPortalService.js';
import { smokeDbUri } from './smokeDbUri.js';

async function main() {
  await mongoose.connect(smokeDbUri(config.mongo.uri, 'aurah360_smoke_dependent_scoping'));
  await mongoose.connection.dropDatabase();

  const branchId = new mongoose.Types.ObjectId();

  const guardian = await Patient.create({
    mrn: `MRN-GUARD-${Date.now()}`,
    firstName: 'Guardian',
    lastName: 'Scoping',
    gender: 'FEMALE',
    mobile: '9812346000',
    portalEnabled: true,
    primaryBranchId: branchId,
  });

  const dependent = await Patient.create({
    mrn: `MRN-DEP-${Date.now()}`,
    firstName: 'Dependent',
    lastName: 'Scoping',
    gender: 'MALE',
    dateOfBirth: new Date('2016-01-01'),
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
    mobile: '9812346999',
    primaryBranchId: branchId,
  });

  const portal = new PatientPortalService();

  // --- Guardian can fetch dependent-scoped resources ---
  const appts = await portal.dependentAppointments(guardian._id.toString(), dependent._id.toString());
  console.log('dependentAppointments OK:', Array.isArray(appts) || Array.isArray(appts?.items) || Array.isArray(appts?.appointments));

  const invoices = await portal.dependentInvoices(guardian._id.toString(), dependent._id.toString());
  console.log('dependentInvoices OK:', invoices != null);

  const docs = await portal.dependentDocuments(guardian._id.toString(), dependent._id.toString());
  console.log('dependentDocuments OK:', docs != null);

  const plans = await portal.dependentTreatmentPlans(guardian._id.toString(), dependent._id.toString());
  console.log('dependentTreatmentPlans OK:', plans != null);

  // --- Non-guardian is rejected for every resource ---
  const cases = [
    ['dependentAppointments', () => portal.dependentAppointments(otherGuardian._id.toString(), dependent._id.toString())],
    ['dependentInvoices', () => portal.dependentInvoices(otherGuardian._id.toString(), dependent._id.toString())],
    ['dependentDocuments', () => portal.dependentDocuments(otherGuardian._id.toString(), dependent._id.toString())],
    ['dependentTreatmentPlans', () => portal.dependentTreatmentPlans(otherGuardian._id.toString(), dependent._id.toString())],
    [
      'bookDependentAppointment',
      () =>
        portal.bookDependentAppointment(otherGuardian._id.toString(), dependent._id.toString(), {
          doctorId: new mongoose.Types.ObjectId().toString(),
          branchId: branchId.toString(),
          appointmentDate: new Date(Date.now() + 86400000).toISOString(),
          appointmentType: 'CONSULTATION',
        }),
    ],
  ];

  for (const [name, fn] of cases) {
    try {
      await fn();
      throw new Error(`A non-guardian should not be able to access ${name}!`);
    } catch (err) {
      if (err.message.startsWith('A non-guardian should not')) throw err;
      console.log(`Non-guardian correctly rejected for ${name}:`, err.message);
    }
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
