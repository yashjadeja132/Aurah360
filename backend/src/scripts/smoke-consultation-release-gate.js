/**
 * Ad-hoc smoke test (not part of Vitest) proving the patient-portal
 * consultation read path only exposes consultations that a doctor has
 * explicitly released (patientFacingReleasedAt set), and only the
 * patient-safe summary — never raw soap/diagnosis/examination/photos.
 *
 * Also confirms staff-side access (ConsultationService.listByPatient /
 * getWorkspace) is unaffected and still returns full clinical data
 * regardless of release status.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import Patient from '../models/Patient.model.js';
import Consultation from '../models/Consultation.model.js';
import { ConsultationSoapRepository } from '../repositories/ConsultationClinicalRepository.js';
import { CONSULTATION_STATUS } from '../enums/consultation.js';
import ConsultationService from '../services/ConsultationService.js';
import PatientPortalService from '../services/PatientPortalService.js';
import { smokeDbUri } from './smokeDbUri.js';

async function main() {
  await mongoose.connect(smokeDbUri(config.mongo.uri, 'aurah360_smoke_release_gate'));
  await mongoose.connection.dropDatabase();

  const patient = await Patient.create({
    mrn: `MRN-REL-${Date.now()}`,
    firstName: 'Release',
    lastName: 'Smoke',
    gender: 'FEMALE',
    mobile: '9822233344',
    portalEnabled: true,
    primaryBranchId: new mongoose.Types.ObjectId(),
  });

  const doctorId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();
  const doctorUserId = new mongoose.Types.ObjectId();

  // Unreleased, signed consultation — should NOT be visible to the patient.
  const unreleased = await Consultation.create({
    consultationNumber: `CN-UNREL-${Date.now()}`,
    appointmentId: new mongoose.Types.ObjectId(),
    patientId: patient._id,
    doctorId,
    branchId,
    status: CONSULTATION_STATUS.SIGNED,
    startedAt: new Date(),
    chiefComplaint: 'Confidential chief complaint (unreleased)',
  });

  const soapRepo = new ConsultationSoapRepository();
  await soapRepo.create({
    consultationId: unreleased._id,
    versions: [
      {
        version: 1,
        subjective: 'SECRET SUBJECTIVE NOTE',
        objective: 'SECRET OBJECTIVE NOTE',
        assessment: 'SECRET ASSESSMENT',
        plan: 'SECRET PLAN',
      },
    ],
  });

  // Released consultation — should be visible, but only with the
  // patient-facing summary, not the raw SOAP content.
  const released = await Consultation.create({
    consultationNumber: `CN-REL-${Date.now()}`,
    appointmentId: new mongoose.Types.ObjectId(),
    patientId: patient._id,
    doctorId,
    branchId,
    status: CONSULTATION_STATUS.SIGNED,
    startedAt: new Date(),
    chiefComplaint: 'Confidential chief complaint (released)',
    patientFacingSummary: 'You had a routine check-up. Everything looks fine.',
    patientFacingReleasedAt: new Date(),
    patientFacingReleasedBy: doctorUserId,
  });

  await soapRepo.create({
    consultationId: released._id,
    versions: [
      {
        version: 1,
        subjective: 'SECRET SUBJECTIVE NOTE (released consultation, internal only)',
        objective: 'SECRET OBJECTIVE NOTE',
        assessment: 'SECRET ASSESSMENT',
        plan: 'SECRET PLAN',
      },
    ],
  });

  const portal = new PatientPortalService();
  const consultationService = new ConsultationService();

  // ── (a) Patient-portal list: unreleased must be absent ─────────────
  const portalList = await portal.listConsultations(patient._id.toString());
  const portalListIds = portalList.map((c) => c.id);
  console.log('portal listConsultations ->', portalListIds);

  if (portalListIds.includes(unreleased._id.toString())) {
    throw new Error('FAIL: unreleased consultation leaked into patient portal list!');
  }
  if (!portalListIds.includes(released._id.toString())) {
    throw new Error('FAIL: released consultation missing from patient portal list!');
  }
  const listedReleased = portalList.find((c) => c.id === released._id.toString());
  if (listedReleased.soap || listedReleased.diagnosis || listedReleased.examination || listedReleased.photos) {
    throw new Error('FAIL: patient portal list entry contains raw clinical fields!');
  }
  console.log('PASS: portal list excludes unreleased consultation and has no raw clinical fields');

  // ── (a) Patient-portal detail: unreleased must 404 ──────────────────
  try {
    await portal.getConsultation(patient._id.toString(), unreleased._id.toString());
    throw new Error('FAIL: unreleased consultation detail was returned to patient portal!');
  } catch (err) {
    if (!/not yet available/i.test(err.message)) throw err;
    console.log('PASS: unreleased consultation detail correctly rejected:', err.message);
  }

  // ── (b) Patient-portal detail: released must appear with safe content only ──
  const releasedDetail = await portal.getConsultation(patient._id.toString(), released._id.toString());
  console.log('portal getConsultation(released) ->', JSON.stringify(releasedDetail));

  if (releasedDetail.summary !== released.patientFacingSummary) {
    throw new Error('FAIL: released consultation summary mismatch!');
  }
  const serialized = JSON.stringify(releasedDetail);
  if (/SECRET/.test(serialized)) {
    throw new Error('FAIL: raw SOAP content leaked into patient portal detail response!');
  }
  if (releasedDetail.soap || releasedDetail.diagnoses || releasedDetail.examination || releasedDetail.photos) {
    throw new Error('FAIL: raw clinical fields present on patient portal detail response!');
  }
  console.log('PASS: released consultation detail exposes only the patient-facing summary');

  // ── (c) Staff-side access unaffected — full clinical data regardless of release ──
  const staffList = await consultationService.listByPatient(patient._id.toString());
  const staffIds = staffList.map((c) => c.id);
  if (!staffIds.includes(unreleased._id.toString()) || !staffIds.includes(released._id.toString())) {
    throw new Error('FAIL: staff-side listByPatient no longer returns all consultations!');
  }

  const staffWorkspaceUnreleased = await consultationService.getWorkspace(unreleased._id.toString());
  if (staffWorkspaceUnreleased.soap?.versions?.[0]?.subjective !== 'SECRET SUBJECTIVE NOTE') {
    throw new Error('FAIL: staff-side getWorkspace no longer returns full SOAP for unreleased consultation!');
  }
  console.log('PASS: staff-side ConsultationService still returns full clinical data regardless of release status');

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
