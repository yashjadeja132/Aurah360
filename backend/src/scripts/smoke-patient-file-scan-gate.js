/**
 * Ad-hoc smoke test for the malware-scan gate applied to the patient-portal file handlers
 * (Task #50 — mirrors smoke-file-access.js but exercises `patientDocument`/`patientPhoto`).
 * Not part of Vitest — isolated test DB, self-cleaning.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import request from 'supertest';
import config from '../config/index.js';
import App from '../app.js';
import PatientDocument from '../models/PatientDocument.model.js';
import Patient from '../models/Patient.model.js';
import PatientTokenService from '../services/PatientTokenService.js';
import { SCAN_STATE, PATIENT_VISIBILITY } from '../enums/patient.js';
import { ENTITY_STATUS } from '../constants/index.js';
import StorageFactory from '../storage/StorageFactory.js';

const patientTokenService = new PatientTokenService();
const storage = StorageFactory.create();

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function main() {
  await mongoose.connect(config.mongo.uri.replace(/\/([^/?]+)$/, '/aurah360_smoke_patient_file_scan_gate'));
  await mongoose.connection.dropDatabase();

  const app = new App().getExpressApp();

  const patient = await Patient.create({
    mrn: `MRN-PFILE-${Date.now()}`,
    firstName: 'Patient',
    lastName: 'Smoke',
    gender: 'FEMALE',
    mobile: '9800000002',
    primaryBranchId: new mongoose.Types.ObjectId(),
    portalEnabled: true,
    isActive: true,
    status: ENTITY_STATUS.ACTIVE,
  });

  const patientAccessToken = patientTokenService.signAccessToken({ sub: patient._id.toString() });

  async function makeDoc(scanState, label) {
    const saved = await storage.save(Buffer.from(`hello-${label}`), {
      folder: `patients/${patient._id}`,
      filename: `${label}.txt`,
      mimeType: 'text/plain',
    });
    return PatientDocument.create({
      patientId: patient._id,
      category: 'LAB_REPORT',
      title: `${label} doc`,
      clinicalDate: new Date(),
      originalName: `${label}.txt`,
      storageKey: saved.key,
      mimeType: 'text/plain',
      scanState,
      patientVisibility: PATIENT_VISIBILITY.RELEASED,
    });
  }

  // 1. CLEAN + released document serves normally to the owning patient.
  const cleanDoc = await makeDoc(SCAN_STATE.CLEAN, 'clean');
  const cleanRes = await request(app)
    .get(`${config.app.apiPrefix}/files/patient/documents/${cleanDoc._id}`)
    .set('Authorization', `Bearer ${patientAccessToken}`);
  assert(cleanRes.status === 200, `CLEAN doc should serve 200, got ${cleanRes.status} (${JSON.stringify(cleanRes.body)})`);
  console.log('CLEAN doc served 200 to owning patient: PASS');

  // 2. QUARANTINED document — even though it belongs to and is released to this patient —
  //    must be blocked with 403 (the vulnerability this fix closes).
  const quarantinedDoc = await makeDoc(SCAN_STATE.QUARANTINED, 'quarantined');
  const quarantinedRes = await request(app)
    .get(`${config.app.apiPrefix}/files/patient/documents/${quarantinedDoc._id}`)
    .set('Authorization', `Bearer ${patientAccessToken}`);
  assert(quarantinedRes.status === 403, `QUARANTINED doc should be 403, got ${quarantinedRes.status}`);
  console.log('QUARANTINED doc blocked 403 for owning patient: PASS');

  // 3. PENDING document returns 202 "still scanning", not a hard error.
  const pendingDoc = await makeDoc(SCAN_STATE.PENDING, 'pending');
  const pendingRes = await request(app)
    .get(`${config.app.apiPrefix}/files/patient/documents/${pendingDoc._id}`)
    .set('Authorization', `Bearer ${patientAccessToken}`);
  assert(pendingRes.status === 202, `PENDING doc should be 202, got ${pendingRes.status}`);
  console.log('PENDING doc returned 202 "still scanning" for patient: PASS');

  // 4. REJECTED document is also blocked with 403.
  const rejectedDoc = await makeDoc(SCAN_STATE.REJECTED, 'rejected');
  const rejectedRes = await request(app)
    .get(`${config.app.apiPrefix}/files/patient/documents/${rejectedDoc._id}`)
    .set('Authorization', `Bearer ${patientAccessToken}`);
  assert(rejectedRes.status === 403, `REJECTED doc should be 403, got ${rejectedRes.status}`);
  console.log('REJECTED doc blocked 403 for owning patient: PASS');

  // 5. Same scan-gate behaviour for the photo handler (CLEAN serves, QUARANTINED blocks).
  const { ClinicalPhotoRepository } = await import('../repositories/ConsultationClinicalRepository.js');
  const ClinicalPhoto = (await import('../models/ClinicalPhoto.model.js')).default;
  void ClinicalPhotoRepository;

  async function makePhoto(scanState, label) {
    const saved = await storage.save(Buffer.from(`photo-${label}`), {
      folder: `patients/${patient._id}/photos`,
      filename: `${label}.jpg`,
      mimeType: 'image/jpeg',
    });
    return ClinicalPhoto.create({
      patientId: patient._id,
      consultationId: new mongoose.Types.ObjectId(),
      storageKey: saved.key,
      mimeType: 'image/jpeg',
      originalName: `${label}.jpg`,
      scanState,
      patientVisibility: PATIENT_VISIBILITY.RELEASED,
    });
  }

  const cleanPhoto = await makePhoto(SCAN_STATE.CLEAN, 'clean');
  const cleanPhotoRes = await request(app)
    .get(`${config.app.apiPrefix}/files/patient/photos/${cleanPhoto._id}`)
    .set('Authorization', `Bearer ${patientAccessToken}`);
  assert(cleanPhotoRes.status === 200, `CLEAN photo should serve 200, got ${cleanPhotoRes.status}`);
  console.log('CLEAN photo served 200 to owning patient: PASS');

  const quarantinedPhoto = await makePhoto(SCAN_STATE.QUARANTINED, 'quarantined');
  const quarantinedPhotoRes = await request(app)
    .get(`${config.app.apiPrefix}/files/patient/photos/${quarantinedPhoto._id}`)
    .set('Authorization', `Bearer ${patientAccessToken}`);
  assert(quarantinedPhotoRes.status === 403, `QUARANTINED photo should be 403, got ${quarantinedPhotoRes.status}`);
  console.log('QUARANTINED photo blocked 403 for owning patient: PASS');

  const pendingPhoto = await makePhoto(SCAN_STATE.PENDING, 'pending');
  const pendingPhotoRes = await request(app)
    .get(`${config.app.apiPrefix}/files/patient/photos/${pendingPhoto._id}`)
    .set('Authorization', `Bearer ${patientAccessToken}`);
  assert(pendingPhotoRes.status === 202, `PENDING photo should be 202, got ${pendingPhotoRes.status}`);
  console.log('PENDING photo returned 202 "still scanning" for patient: PASS');

  // 6. Ownership check is still enforced independently of the scan gate — a different
  //    patient's clean, released document is still forbidden.
  const otherPatient = await Patient.create({
    mrn: `MRN-PFILE-OTHER-${Date.now()}`,
    firstName: 'Other',
    lastName: 'Patient',
    gender: 'MALE',
    mobile: '9800000003',
    primaryBranchId: new mongoose.Types.ObjectId(),
    portalEnabled: true,
    isActive: true,
    status: ENTITY_STATUS.ACTIVE,
  });
  const otherToken = patientTokenService.signAccessToken({ sub: otherPatient._id.toString() });
  const notOwnedRes = await request(app)
    .get(`${config.app.apiPrefix}/files/patient/documents/${cleanDoc._id}`)
    .set('Authorization', `Bearer ${otherToken}`);
  assert(notOwnedRes.status === 403, `Non-owning patient should be 403, got ${notOwnedRes.status}`);
  console.log('Non-owning patient rejected 403 (ownership check unaffected): PASS');

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
