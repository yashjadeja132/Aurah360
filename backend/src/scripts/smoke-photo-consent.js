/**
 * Ad-hoc smoke test for photography-consent enforcement in
 * ConsultationClinicalService.uploadPhoto() (not part of Vitest).
 *
 * Verifies:
 *  (a) uploading a clinical photo for a patient with NO CLINICAL_PHOTOGRAPHY consent grant
 *      is rejected (hard stop), and no photo record is persisted.
 *  (b) after granting CLINICAL_PHOTOGRAPHY consent via ConsentService, the same upload
 *      succeeds and `consentVerified` genuinely reflects the real grant (not a client-supplied
 *      value) — including when the caller lies and sends consentVerified: false.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import Patient from '../models/Patient.model.js';
import Consultation from '../models/Consultation.model.js';
import ClinicalPhoto from '../models/ClinicalPhoto.model.js';
import ConsultationClinicalService from '../services/ConsultationClinicalService.js';
import ConsentService from '../services/ConsentService.js';
import { CONSENT_PURPOSE } from '../enums/privacy.js';

async function main() {
  await mongoose.connect(config.mongo.uri.replace(/\/([^/?]+)$/, '/aurah360_smoke_photo_consent'));
  await mongoose.connection.dropDatabase();

  const patient = await Patient.create({
    mrn: `MRN-PHOTO-${Date.now()}`,
    firstName: 'Photo',
    lastName: 'Smoke',
    gender: 'FEMALE',
    mobile: '9876500000',
    primaryBranchId: new mongoose.Types.ObjectId(),
  });

  const consultation = await Consultation.create({
    consultationNumber: `CONS-PHOTO-${Date.now()}`,
    appointmentId: new mongoose.Types.ObjectId(),
    patientId: patient._id,
    doctorId: new mongoose.Types.ObjectId(),
    branchId: new mongoose.Types.ObjectId(),
  });

  const actorId = new mongoose.Types.ObjectId();
  const clinicalService = new ConsultationClinicalService();
  const consentService = new ConsentService();

  const fakeFile = {
    buffer: Buffer.from('fake-image-bytes'),
    originalname: 'before-face.jpg',
    mimetype: 'image/jpeg',
  };

  // (a) No consent grant at all — must be rejected, even though the client claims consentVerified: true.
  let rejected = false;
  try {
    await clinicalService.uploadPhoto(
      consultation._id.toString(),
      {
        file: fakeFile,
        photoType: 'BEFORE',
        title: 'Before photo',
        bodyRegion: 'face',
        consentVerified: true, // client lies — no real grant exists
      },
      actorId
    );
  } catch (err) {
    rejected = true;
    console.log('Upload with NO consent grant correctly rejected:', err.message, err.code || '');
    if (err.code && err.code !== 'PHOTOGRAPHY_CONSENT_NOT_GRANTED') {
      throw new Error(`Unexpected error code: ${err.code}`);
    }
  }
  if (!rejected) throw new Error('Upload should have been rejected without a consent grant!');

  const photoCountAfterRejection = await ClinicalPhoto.countDocuments({ consultationId: consultation._id });
  if (photoCountAfterRejection !== 0) {
    throw new Error('No photo record should have been persisted after a rejected upload!');
  }
  console.log('Confirmed no photo record persisted after rejection.');

  // (b) Grant CLINICAL_PHOTOGRAPHY consent via ConsentService, then retry — should now succeed,
  // with consentVerified reflecting the real grant even though the caller sends false.
  await consentService.grant(
    { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY, method: 'STAFF_ENTERED' },
    actorId
  );

  const photo = await clinicalService.uploadPhoto(
    consultation._id.toString(),
    {
      file: fakeFile,
      photoType: 'BEFORE',
      title: 'Before photo',
      bodyRegion: 'face',
      consentVerified: false, // client lies the other way — real grant must still win
    },
    actorId
  );

  console.log('Upload after granting consent succeeded. consentVerified:', photo.consentVerified);
  if (photo.consentVerified !== true) {
    throw new Error('consentVerified should be true once a real CLINICAL_PHOTOGRAPHY grant exists!');
  }
  if (!photo.consentVerifiedAt || !photo.consentVerifiedBy) {
    throw new Error('consentVerifiedAt/consentVerifiedBy should be populated on real verification!');
  }

  const persisted = await ClinicalPhoto.findById(photo.id);
  if (!persisted || persisted.consentVerified !== true) {
    throw new Error('Persisted photo record should have consentVerified: true!');
  }
  console.log('Confirmed persisted photo record has consentVerified: true, reflecting the real grant.');

  // Sanity: marketing-image-use consent purpose is tracked separately and was never granted here.
  if (persisted.marketingConsentVerified !== false) {
    throw new Error('marketingConsentVerified should remain false — MARKETING_IMAGE_USE was never granted!');
  }
  console.log('Confirmed marketingConsentVerified stayed false (separate, ungranted purpose).');

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
