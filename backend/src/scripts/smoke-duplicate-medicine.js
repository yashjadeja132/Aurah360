/**
 * Ad-hoc smoke test for the duplicate-medicine warning check on
 * PrescriptionService#create / #updateDraft (not part of Vitest).
 * Isolated DB, self-cleaning — mirrors smoke-otp-login.js's style.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import '../models/index.js'; // registers every model so populate() paths resolve
import Consultation from '../models/Consultation.model.js';
import PrescriptionService from '../services/PrescriptionService.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function makeConsultation({ patientId, doctorId, branchId }) {
  return Consultation.create({
    consultationNumber: `CN-SMOKE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    appointmentId: new mongoose.Types.ObjectId(),
    patientId,
    doctorId,
    branchId,
    status: 'IN_PROGRESS',
  });
}

async function main() {
  await mongoose.connect(
    config.mongo.uri.replace(/\/([^/?]+)$/, '/aurah360_smoke_duplicate_medicine')
  );
  await mongoose.connection.dropDatabase();

  const patientId = new mongoose.Types.ObjectId();
  const doctorId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId().toString();

  const prescriptionService = new PrescriptionService();

  // --- (a) same medicine listed twice within one prescription ---
  const consultation1 = await makeConsultation({ patientId, doctorId, branchId });
  const rxWithInternalDup = await prescriptionService.create(
    {
      consultationId: consultation1._id.toString(),
      items: [
        { medicineName: 'Paracetamol 500mg', dosage: '1 tab', frequency: 'Twice daily' },
        { medicineName: 'Paracetamol 500mg', dosage: '1 tab', frequency: 'Thrice daily' },
      ],
    },
    actorId
  );
  assert(rxWithInternalDup.id, 'Prescription with internal duplicate should still save');
  assert(
    rxWithInternalDup.warnings?.some((w) => w.type === 'DUPLICATE_IN_PRESCRIPTION'),
    `Expected DUPLICATE_IN_PRESCRIPTION warning, got ${JSON.stringify(rxWithInternalDup.warnings)}`
  );
  console.log('✓ (a) duplicate within same prescription flagged, save succeeded:', rxWithInternalDup.warnings);

  // Finalize it so it counts as "active" for the next check.
  await prescriptionService.finalize(rxWithInternalDup.id, actorId);

  // --- (b) second active prescription reusing a medicine from the first ---
  const consultation2 = await makeConsultation({ patientId, doctorId, branchId });
  const rxCrossActive = await prescriptionService.create(
    {
      consultationId: consultation2._id.toString(),
      items: [{ medicineName: 'Paracetamol 500mg', dosage: '1 tab', frequency: 'Once daily' }],
    },
    actorId
  );
  assert(rxCrossActive.id, 'Prescription with cross-active duplicate should still save');
  const crossWarning = rxCrossActive.warnings?.find((w) => w.type === 'DUPLICATE_ACROSS_ACTIVE');
  assert(
    crossWarning,
    `Expected DUPLICATE_ACROSS_ACTIVE warning, got ${JSON.stringify(rxCrossActive.warnings)}`
  );
  assert(
    crossWarning.conflictingPrescriptionId === rxWithInternalDup.id,
    `Expected conflict to point at the first prescription (${rxWithInternalDup.id}), got ${crossWarning.conflictingPrescriptionId}`
  );
  console.log('✓ (b) duplicate across active prescriptions flagged, save succeeded:', rxCrossActive.warnings);

  // --- (c) a clean prescription (different patient, no overlap) has no warnings ---
  const otherPatientId = new mongoose.Types.ObjectId();
  const consultation3 = await makeConsultation({
    patientId: otherPatientId,
    doctorId,
    branchId,
  });
  const cleanRx = await prescriptionService.create(
    {
      consultationId: consultation3._id.toString(),
      items: [{ medicineName: 'Amoxicillin 250mg', dosage: '1 cap', frequency: 'Thrice daily' }],
    },
    actorId
  );
  assert(cleanRx.id, 'Clean prescription should save');
  assert(
    Array.isArray(cleanRx.warnings) && cleanRx.warnings.length === 0,
    `Expected no warnings for a clean prescription, got ${JSON.stringify(cleanRx.warnings)}`
  );
  console.log('✓ (c) clean prescription has no warnings');

  // --- (d) updateDraft path also surfaces warnings without blocking the save ---
  const consultation4 = await makeConsultation({ patientId, doctorId, branchId });
  const draftRx = await prescriptionService.create(
    {
      consultationId: consultation4._id.toString(),
      items: [{ medicineName: 'Cetirizine 10mg', dosage: '1 tab', frequency: 'Once daily' }],
    },
    actorId
  );
  const updatedRx = await prescriptionService.updateDraft(
    draftRx.id,
    {
      items: [
        { medicineName: 'Cetirizine 10mg', dosage: '1 tab', frequency: 'Once daily' },
        { medicineName: 'Cetirizine 10mg', dosage: '1 tab', frequency: 'Once daily' },
      ],
    },
    actorId
  );
  assert(updatedRx.id, 'updateDraft with duplicate items should still save');
  assert(
    updatedRx.warnings?.some((w) => w.type === 'DUPLICATE_IN_PRESCRIPTION'),
    `Expected DUPLICATE_IN_PRESCRIPTION warning on updateDraft, got ${JSON.stringify(updatedRx.warnings)}`
  );
  console.log('✓ (d) updateDraft() also surfaces duplicate warnings, non-blocking:', updatedRx.warnings);

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
