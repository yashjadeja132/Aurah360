import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import App from '../../src/app.js';
import '../../src/models/index.js';
import Patient from '../../src/models/Patient.model.js';
import Consultation from '../../src/models/Consultation.model.js';
import ClinicalPhoto from '../../src/models/ClinicalPhoto.model.js';
import User from '../../src/models/User.model.js';
import AuditLog from '../../src/models/AuditLog.model.js';
import ConsentService from '../../src/services/ConsentService.js';
import ConsultationClinicalService from '../../src/services/ConsultationClinicalService.js';
import PatientTokenService from '../../src/services/PatientTokenService.js';
import TokenService from '../../src/services/TokenService.js';
import { hashPassword } from '../../src/helpers/crypto.helper.js';
import { ROLE_PERMISSIONS } from '../../src/constants/rolePermissions.js';
import { ROLES } from '../../src/constants/roles.js';
import { CONSENT_PURPOSE } from '../../src/enums/privacy.js';
import { AUDIT_ACTIONS } from '../../src/enums/auditAction.js';
import { PATIENT_VISIBILITY } from '../../src/enums/patient.js';

/**
 * IMG-005 (P0) — doctor-controlled release of a clinical photo to the patient portal.
 *
 * The original defect: `ClinicalPhoto.patientVisibility` defaulted to HIDDEN and NO code path
 * anywhere ever wrote it. The field had exactly two read sites, both in FileAccessController, so
 * the portal's "Not released" refusal was permanent and unconditional — a patient could never be
 * shown their own before/after images, and `releasedBy`/`releasedAt` were dead schema. Patient
 * DOCUMENTS had a release route; photos had none.
 *
 * The property under test is the round trip through the real portal endpoint, not the field value:
 * a released photo is SERVED and a hidden one is REFUSED. Asserting only the database write would
 * pass even if nothing downstream honoured it, which is the shape of the bug being fixed.
 *
 * Both directions matter equally. A release path that cannot be undone is its own P0 — a photo
 * released in error must be retractable — so un-release is asserted as hard as release.
 */
describe('IMG-005 clinical photo release to the patient portal', () => {
  let app;
  const consentService = new ConsentService();
  const clinicalService = new ConsultationClinicalService();
  const patientTokenService = new PatientTokenService();
  const staffTokenService = new TokenService();

  const branchId = new mongoose.Types.ObjectId();
  const doctorId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();

  let seq = 0;
  let doctorToken;

  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const patientBearer = (patient) =>
    patientTokenService.signAccessToken({ sub: patient._id.toString() });

  /** Real JPEG magic bytes — upload content-sniffs the buffer, so a placeholder string is rejected. */
  function jpeg() {
    return {
      buffer: Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        Buffer.from(`jpeg-body-${(seq += 1)}`),
      ]),
      originalname: 'capture.jpg',
      mimetype: 'image/jpeg',
    };
  }

  async function newPatient(label) {
    seq += 1;
    return Patient.create({
      mrn: `MRN-REL-${label}-${Date.now()}-${seq}`,
      firstName: 'Photo',
      lastName: label,
      gender: 'FEMALE',
      mobile: `91000${String(1000 + seq)}`,
      primaryBranchId: branchId,
      portalEnabled: true,
      isActive: true,
      status: 'ACTIVE',
    });
  }

  async function newConsultation(patientId, status = 'IN_PROGRESS') {
    seq += 1;
    return Consultation.create({
      consultationNumber: `CN-REL-${Date.now()}-${seq}`,
      appointmentId: new mongoose.Types.ObjectId(),
      patientId,
      doctorId,
      branchId,
      status,
    });
  }

  /** A consented patient with one captured photo — the normal state before any release decision. */
  async function capture(label) {
    const patient = await newPatient(label);
    await consentService.grant(
      { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY },
      actorId
    );
    const consultation = await newConsultation(patient._id);
    const photo = await clinicalService.uploadPhoto(
      consultation._id.toString(),
      { file: jpeg(), photoType: 'BEFORE', title: 'left cheek', bodyRegion: 'left cheek' },
      actorId
    );
    return { patient, consultation, photo };
  }

  beforeAll(async () => {
    await connectTestDb('photorel');
    app = new App().getExpressApp();
    await consentService.seedDefaultDefinitions(actorId);

    // Real storage on purpose: the portal endpoint streams bytes off disk, so a stubbed driver
    // would make the "IS served" assertion vacuous.
    const doctorUser = await User.create({
      firstName: 'Rel',
      lastName: 'Doctor',
      email: `rel-doctor-${Date.now()}@photorel.test`,
      passwordHash: await hashPassword('Password@12345'),
      employeeId: `EMP-RELDOC-${Date.now()}`,
      role: ROLES.DOCTOR,
      branch: null,
      isActive: true,
      status: 'ACTIVE',
    });
    doctorToken = staffTokenService.signAccessToken({
      sub: doctorUser._id.toString(),
      role: ROLES.DOCTOR,
      permissions: ROLE_PERMISSIONS[ROLES.DOCTOR] || [],
      branch: null,
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  it('refuses a freshly captured photo to the patient portal — capture is not release', async () => {
    const { patient, photo } = await capture('fresh');

    // The default is the safe one and must stay that way: capture consent is not release consent.
    expect(photo.patientVisibility).toBe(PATIENT_VISIBILITY.HIDDEN);

    const res = await request(app)
      .get(`/api/v1/files/patient/photos/${photo.id}`)
      .set(auth(patientBearer(patient)));

    expect(res.status).toBe(403);
  });

  it('serves the photo to the patient once a doctor releases it', async () => {
    const { patient, photo } = await capture('released');

    await clinicalService.releasePhoto(
      photo.id,
      { visibility: PATIENT_VISIBILITY.RELEASED },
      actorId
    );

    const res = await request(app)
      .get(`/api/v1/files/patient/photos/${photo.id}`)
      .set(auth(patientBearer(patient)));

    // Bytes, not just a 200 — a released photo the portal cannot actually render is still broken.
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('stamps releasedBy/releasedAt and audits the release', async () => {
    const { photo } = await capture('stamped');

    const released = await clinicalService.releasePhoto(
      photo.id,
      { visibility: PATIENT_VISIBILITY.RELEASED },
      actorId
    );

    expect(released.patientVisibility).toBe(PATIENT_VISIBILITY.RELEASED);
    // These two fields existed on the model with no writer at all; who released an image and when
    // is the whole audit question for a clinical photograph.
    expect(released.releasedBy).toBe(actorId.toString());
    expect(released.releasedAt).toBeTruthy();

    const log = await AuditLog.findOne({
      action: AUDIT_ACTIONS.PHOTO_RELEASED,
      'metadata.photoId': photo.id,
    });
    expect(log).toBeTruthy();
    expect(log.metadata.visibility).toBe(PATIENT_VISIBILITY.RELEASED);
    // The prior state is what makes the entry reviewable — "released" alone does not say from what.
    expect(log.metadata.previousVisibility).toBe(PATIENT_VISIBILITY.HIDDEN);
  });

  it('un-releases a photo: the portal refuses it again and the release stamp is cleared', async () => {
    const { patient, photo } = await capture('retract');
    const bearer = patientBearer(patient);

    await clinicalService.releasePhoto(photo.id, { visibility: PATIENT_VISIBILITY.RELEASED }, actorId);
    const served = await request(app)
      .get(`/api/v1/files/patient/photos/${photo.id}`)
      .set(auth(bearer));
    expect(served.status).toBe(200);

    const hidden = await clinicalService.releasePhoto(
      photo.id,
      { visibility: PATIENT_VISIBILITY.HIDDEN },
      actorId
    );

    expect(hidden.patientVisibility).toBe(PATIENT_VISIBILITY.HIDDEN);
    // A release stamp that outlives the release it recorded is a false audit trail on the row.
    expect(hidden.releasedBy).toBeNull();
    expect(hidden.releasedAt).toBeNull();

    const refused = await request(app)
      .get(`/api/v1/files/patient/photos/${photo.id}`)
      .set(auth(bearer));
    expect(refused.status).toBe(403);
  });

  it('refuses to release a photo whose photography consent was never verified', async () => {
    // The portal byte-serving path does NOT re-check consentVerified (only the staff path does),
    // so release is the last gate a legacy/bypassed row passes through.
    const patient = await newPatient('unverified');
    const consultation = await newConsultation(patient._id);
    const legacy = await ClinicalPhoto.create({
      consultationId: consultation._id,
      patientId: patient._id,
      photoType: 'BEFORE',
      title: 'legacy row',
      storageKey: 'legacy/key.jpg',
      originalName: 'key.jpg',
      mimeType: 'image/jpeg',
      size: 10,
    });

    await expect(
      clinicalService.releasePhoto(
        legacy._id.toString(),
        { visibility: PATIENT_VISIBILITY.RELEASED },
        actorId
      )
    ).rejects.toMatchObject({ statusCode: 403, code: 'PHOTOGRAPHY_CONSENT_NOT_VERIFIED' });

    const unchanged = await ClinicalPhoto.findById(legacy._id);
    expect(unchanged.patientVisibility).toBe(PATIENT_VISIBILITY.HIDDEN);
  });

  it('refuses to release once photography consent has been withdrawn', async () => {
    // Consent is revocable. A flag set at capture time is not authority to push the image at a
    // patient who has since said no.
    const { patient, photo } = await capture('withdrawn');
    await consentService.withdraw(
      {
        patientId: patient._id,
        purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY,
        reason: 'changed mind',
      },
      actorId
    );

    await expect(
      clinicalService.releasePhoto(photo.id, { visibility: PATIENT_VISIBILITY.RELEASED }, actorId)
    ).rejects.toMatchObject({ code: 'PHOTOGRAPHY_CONSENT_NOT_GRANTED' });
  });

  it('still allows un-release after consent withdrawal', async () => {
    // Withdrawal must never TRAP an already-released image as visible. The consent re-check
    // deliberately only guards the direction that increases exposure.
    const { patient, photo } = await capture('withdrawnhide');
    await clinicalService.releasePhoto(photo.id, { visibility: PATIENT_VISIBILITY.RELEASED }, actorId);
    await consentService.withdraw(
      { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY, reason: 'stop' },
      actorId
    );

    const hidden = await clinicalService.releasePhoto(
      photo.id,
      { visibility: PATIENT_VISIBILITY.HIDDEN },
      actorId
    );
    expect(hidden.patientVisibility).toBe(PATIENT_VISIBILITY.HIDDEN);
  });

  it('releases a photo attached to a SIGNED consultation', async () => {
    // Release is a post-signature governance decision. Gating it on an editable consultation (as
    // capture and consent-verification are) would make the feature unreachable in practice.
    const patient = await newPatient('signed');
    await consentService.grant(
      { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY },
      actorId
    );
    const consultation = await newConsultation(patient._id);
    const photo = await clinicalService.uploadPhoto(
      consultation._id.toString(),
      { file: jpeg(), photoType: 'AFTER', title: 'chin', bodyRegion: 'chin' },
      actorId
    );
    await Consultation.updateOne({ _id: consultation._id }, { status: 'SIGNED', locked: true });

    const released = await clinicalService.releasePhoto(
      photo.id,
      { visibility: PATIENT_VISIBILITY.RELEASED },
      actorId
    );
    expect(released.patientVisibility).toBe(PATIENT_VISIBILITY.RELEASED);
  });

  it('carries `visibility` through the HTTP route and validator to the service', async () => {
    /*
     * `validate()` REPLACES the request body with the parsed result, so a field missing from the
     * Zod schema is silently deleted before the controller ever sees it. This suite would still
     * pass with a broken validator if it only ever called the service directly, so the wiring is
     * exercised end to end over real HTTP.
     */
    const { patient, photo } = await capture('httproute');

    const res = await request(app)
      .post(`/api/v1/consultations/photos/${photo.id}/release`)
      .send({ visibility: PATIENT_VISIBILITY.RELEASED })
      .set(auth(doctorToken));

    expect(res.status).toBe(200);
    expect(res.body.data.photo.patientVisibility).toBe(PATIENT_VISIBILITY.RELEASED);

    const served = await request(app)
      .get(`/api/v1/files/patient/photos/${photo.id}`)
      .set(auth(patientBearer(patient)));
    expect(served.status).toBe(200);
  });

  it('rejects an off-enum visibility at the route boundary', async () => {
    const { photo } = await capture('badvis');

    const res = await request(app)
      .post(`/api/v1/consultations/photos/${photo.id}/release`)
      .send({ visibility: 'PUBLIC' })
      .set(auth(doctorToken));

    expect(res.status).toBe(422);
    expect(await ClinicalPhoto.findById(photo.id)).toMatchObject({
      patientVisibility: PATIENT_VISIBILITY.HIDDEN,
    });
  });

  it('never serves one patient a photo released to another', async () => {
    // Release widens visibility for the OWNER of the record only; it is not a global unlock.
    const { photo } = await capture('ownera');
    const other = await newPatient('ownerb');
    await clinicalService.releasePhoto(photo.id, { visibility: PATIENT_VISIBILITY.RELEASED }, actorId);

    const res = await request(app)
      .get(`/api/v1/files/patient/photos/${photo.id}`)
      .set(auth(patientBearer(other)));

    expect(res.status).toBe(403);
  });
});
