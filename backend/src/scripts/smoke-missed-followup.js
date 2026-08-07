/** Ad-hoc smoke test for the missed-follow-up recall scan (not part of Vitest). */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import Patient from '../models/Patient.model.js';
import Consultation from '../models/Consultation.model.js';
import Appointment from '../models/Appointment.model.js';
import RecallEntry from '../models/RecallEntry.model.js';
import { CONSULTATION_STATUS } from '../enums/consultation.js';
import { FOLLOW_UP_UNIT } from '../enums/consultation.js';
import { APPOINTMENT_STATUS } from '../enums/appointment.js';
import { scanForMissedFollowUps, MISSED_FOLLOW_UP_PURPOSE } from '../queues/missedFollowUpJobs.js';

async function makePatient(tag) {
  return Patient.create({
    mrn: `MRN-MFU-${tag}-${Date.now()}`,
    firstName: 'MissedFollowUp',
    lastName: tag,
    gender: 'MALE',
    mobile: `98${String(Date.now()).slice(-8)}`,
    primaryBranchId: new mongoose.Types.ObjectId(),
  });
}

async function makeConsultation({ patientId, endedAt, followUpValue, followUpUnit }) {
  return Consultation.create({
    consultationNumber: `CON-MFU-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    appointmentId: new mongoose.Types.ObjectId(),
    patientId,
    doctorId: new mongoose.Types.ObjectId(),
    branchId: new mongoose.Types.ObjectId(),
    status: CONSULTATION_STATUS.COMPLETED,
    startedAt: endedAt,
    endedAt,
    followUp: { value: followUpValue, unit: followUpUnit, reason: 'Review healing progress' },
  });
}

async function main() {
  await mongoose.connect(config.mongo.uri.replace(/\/([^/?]+)$/, '/aurah360_smoke_missed_followup'));
  await mongoose.connection.dropDatabase();
  // Recreate the partial unique dedup index freshly for this DB.
  await RecallEntry.syncIndexes();

  const now = new Date();

  // —— Scenario 1: past-due follow-up, no subsequent visit → should get a RecallEntry ——
  const patientA = await makePatient('A');
  const endedAtA = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
  const consultationA = await makeConsultation({
    patientId: patientA._id,
    endedAt: endedAtA,
    followUpValue: 5, // due 5 days after the visit → 5 days ago, already overdue
    followUpUnit: FOLLOW_UP_UNIT.DAYS,
  });

  const first = await scanForMissedFollowUps({ now });
  console.log('First scan result:', first);

  const entriesForA = await RecallEntry.find({ consultationId: consultationA._id });
  if (entriesForA.length !== 1) {
    throw new Error(`Expected exactly 1 RecallEntry for patient A, got ${entriesForA.length}`);
  }
  if (entriesForA[0].purpose !== MISSED_FOLLOW_UP_PURPOSE) {
    throw new Error(`Expected purpose "${MISSED_FOLLOW_UP_PURPOSE}", got "${entriesForA[0].purpose}"`);
  }
  console.log('RecallEntry created for patient A:', entriesForA[0].toSafeObject());

  // —— Re-run: dedup check — must NOT create a second entry ——
  const second = await scanForMissedFollowUps({ now });
  console.log('Second scan result (dedup check):', second);
  const entriesForAAfterSecond = await RecallEntry.find({ consultationId: consultationA._id });
  if (entriesForAAfterSecond.length !== 1) {
    throw new Error(`Dedup failed — expected still 1 RecallEntry for patient A, got ${entriesForAAfterSecond.length}`);
  }
  if (second.created !== 0) {
    throw new Error(`Dedup failed — expected 0 created on second scan, got ${second.created}`);
  }

  // —— Scenario 2: past-due follow-up but patient HAS a subsequent completed visit → no recall ——
  const patientB = await makePatient('B');
  const endedAtB = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  const consultationB = await makeConsultation({
    patientId: patientB._id,
    endedAt: endedAtB,
    followUpValue: 5,
    followUpUnit: FOLLOW_UP_UNIT.DAYS,
  });

  // Subsequent completed appointment after the follow-up was set.
  await Appointment.create({
    appointmentNumber: `APT-MFU-${Date.now()}`,
    patientId: patientB._id,
    doctorId: new mongoose.Types.ObjectId(),
    branchId: new mongoose.Types.ObjectId(),
    serviceId: new mongoose.Types.ObjectId(),
    appointmentDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago, after endedAtB
    startTime: '10:00',
    endTime: '10:15',
    status: APPOINTMENT_STATUS.COMPLETED,
  });

  const third = await scanForMissedFollowUps({ now });
  console.log('Third scan result (patient B has subsequent visit):', third);
  const entriesForB = await RecallEntry.find({ consultationId: consultationB._id });
  if (entriesForB.length !== 0) {
    throw new Error(`Expected 0 RecallEntry for patient B (had subsequent visit), got ${entriesForB.length}`);
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
  // BullMQ/ioredis handles for the queue module stay open; this script only exercises the
  // scan+dedup logic, so force-exit rather than wiring up a full graceful shutdown.
  process.exit(0);
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
