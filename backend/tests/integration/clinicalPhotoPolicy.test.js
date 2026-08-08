import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import '../../src/models/index.js';
import Patient from '../../src/models/Patient.model.js';
import Consultation from '../../src/models/Consultation.model.js';
import ClinicalPhoto from '../../src/models/ClinicalPhoto.model.js';
import TreatmentPlan from '../../src/models/TreatmentPlan.model.js';
import TreatmentSession from '../../src/models/TreatmentSession.model.js';
import AuditLog from '../../src/models/AuditLog.model.js';
import ConsentService from '../../src/services/ConsentService.js';
import ConsultationClinicalService from '../../src/services/ConsultationClinicalService.js';
import TreatmentSessionService from '../../src/services/TreatmentSessionService.js';
import { CONSENT_PURPOSE } from '../../src/enums/privacy.js';
import { AUDIT_ACTIONS } from '../../src/enums/auditAction.js';

/**
 * IMG-003 / PRV-001 (P0) — clinical-photo capture policy.
 *
 * The original defect: the TREATMENT-SESSION capture path wrote patient imagery with no
 * photography-consent check and no restricted-body-area check, while the CONSULTATION path
 * enforced both. Patients therefore had intimate/unconsented images persisted (and later served)
 * purely because staff used the session screen instead of the consultation screen.
 *
 * So every behavioural case below is asserted against BOTH entry points from the same table.
 * Adding a third capture path, or letting one path drift from the other, has to fail here — the
 * parity is the property under test, not the shared helper's internals.
 *
 * The ALLOWED cases are asserted as hard as the BLOCKED ones. A capture gate that refuses
 * everything is a clinical outage: staff lose before/after documentation for real treatments and
 * learn to route around the system.
 */
describe('IMG-003 clinical photo capture policy — consent + restricted body area, both capture paths', () => {
  const doctorId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();

  const consentService = new ConsentService();
  const consultationService = new ConsultationClinicalService();
  const sessionService = new TreatmentSessionService();

  let seq = 0;

  /** A minimal in-memory storage stub: the policy must run BEFORE any bytes are written, so the
   *  test records whether storage was ever touched on a blocked capture. */
  const storageWrites = [];
  const fakeStorage = {
    async save(buffer, { folder, filename, mimeType } = {}) {
      const key = `${folder}/${filename}`;
      storageWrites.push(key);
      return { driver: 'test', key, mimeType: mimeType || null, size: buffer.length };
    },
  };

  /**
   * IMG-003/DOC-002 — the capture gate now verifies the file's LEADING BYTES against its declared
   * type (an SVG or HTML page labelled `image/jpeg` used to be storable as a clinical photo), so
   * the fixture starts with the real JPEG SOI marker instead of arbitrary text.
   */
  function jpeg(name = 'capture.jpg') {
    return {
      buffer: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('fake-jpeg-bytes')]),
      originalname: name,
      mimetype: 'image/jpeg',
    };
  }

  async function newPatient(label) {
    seq += 1;
    return Patient.create({
      mrn: `MRN-PHP-${label}-${Date.now()}-${seq}`,
      firstName: 'Photo',
      lastName: label,
      gender: 'FEMALE',
      mobile: `90000${String(1000 + seq)}`,
      primaryBranchId: branchId,
    });
  }

  async function newConsultation(patientId) {
    seq += 1;
    return Consultation.create({
      consultationNumber: `CN-PHP-${Date.now()}-${seq}`,
      appointmentId: new mongoose.Types.ObjectId(),
      patientId,
      doctorId,
      branchId,
      status: 'IN_PROGRESS',
    });
  }

  /**
   * Both capture paths, behind one uniform call signature. Each returns the persisted
   * ClinicalPhoto row so the two can be asserted identically — the session path writes its
   * ClinicalPhoto row through the plan's consultationId.
   */
  const paths = [
    {
      name: 'consultation capture',
      async upload(patient, { bodyRegion = null, file = jpeg(), consentVerified = false } = {}) {
        const consultation = await newConsultation(patient._id);
        const saved = await consultationService.uploadPhoto(
          consultation._id.toString(),
          { file, photoType: 'BEFORE', title: 'test', bodyRegion, consentVerified },
          actorId
        );
        return ClinicalPhoto.findById(saved.id || saved._id);
      },
    },
    {
      name: 'treatment-session capture',
      async upload(patient, { bodyRegion = null, file = jpeg() } = {}) {
        const consultation = await newConsultation(patient._id);
        seq += 1;
        const plan = await TreatmentPlan.create({
          planNumber: `TP-PHP-${Date.now()}-${seq}`,
          consultationId: consultation._id,
          patientId: patient._id,
          doctorId,
          branchId,
          title: 'Photo policy fixture',
          status: 'ACCEPTED',
        });
        const session = await TreatmentSession.create({
          sessionNumber: `TS-PHP-${Date.now()}-${seq}`,
          treatmentPlanId: plan._id,
          patientId: patient._id,
          doctorId,
          branchId,
          status: 'CHECKED_IN',
        });
        await sessionService.uploadPhoto(
          session._id.toString(),
          { file, photoType: 'BEFORE', title: 'test', bodyRegion },
          actorId
        );
        return ClinicalPhoto.findOne({ consultationId: consultation._id }).sort({ createdAt: -1 });
      },
    },
  ];

  beforeAll(async () => {
    await connectTestDb('photopolicy');
    // Start from a clean database: a previous aborted run leaves collections behind, and the
    // shared cluster enforces a hard collection cap that stale suites eat into.
    await dropTestDb();
    // Grants resolve against the active consent definitions, as they do in production.
    await consentService.seedDefaultDefinitions(actorId);
    consultationService.storage = fakeStorage;
    sessionService.storage = fakeStorage;
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  describe.each(paths)('$name', ({ upload }) => {
    it('blocks capture when no photography consent was ever recorded', async () => {
      // The absent-consent state is the dangerous one: it is what every patient looks like
      // before anyone has asked them. It must not read as "nothing on file, so fine".
      const patient = await newPatient('noconsent');
      const before = storageWrites.length;

      await expect(upload(patient)).rejects.toMatchObject({
        statusCode: 403,
        code: 'PHOTOGRAPHY_CONSENT_NOT_GRANTED',
      });

      // Refusal must happen before bytes hit storage — an image on disk is a breach even if
      // no database row survives.
      expect(storageWrites.length).toBe(before);
      expect(await ClinicalPhoto.countDocuments({ patientId: patient._id })).toBe(0);
    });

    it('blocks capture when photography consent exists but has been withdrawn', async () => {
      // Consent is revocable; a stale historical grant must not keep authorising new capture.
      const patient = await newPatient('withdrawn');
      await consentService.grant(
        { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY },
        actorId
      );
      await consentService.withdraw(
        { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY, reason: 'changed mind' },
        actorId
      );

      await expect(upload(patient)).rejects.toMatchObject({
        code: 'PHOTOGRAPHY_CONSENT_NOT_GRANTED',
      });
    });

    it('blocks capture when a different consent purpose is granted but photography is not', async () => {
      // Consent is purpose-bound. Agreeing to marketing image use is not agreeing to be
      // photographed clinically, and must never be read across.
      const patient = await newPatient('otherpurpose');
      await consentService.grant(
        { patientId: patient._id, purpose: CONSENT_PURPOSE.MARKETING_IMAGE_USE },
        actorId
      );

      await expect(upload(patient)).rejects.toMatchObject({
        code: 'PHOTOGRAPHY_CONSENT_NOT_GRANTED',
      });
    });

    it('ignores a caller-supplied consentVerified flag — the grant log is the only authority', async () => {
      // The client must never be able to self-certify consent by posting a boolean.
      const patient = await newPatient('spoofed');

      await expect(upload(patient, { consentVerified: true })).rejects.toMatchObject({
        code: 'PHOTOGRAPHY_CONSENT_NOT_GRANTED',
      });
    });

    it('allows capture on a routine body area once photography consent is granted', async () => {
      const patient = await newPatient('granted');
      await consentService.grant(
        { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY },
        actorId
      );

      const photo = await upload(patient, { bodyRegion: 'left cheek — nasolabial fold' });

      expect(photo).toBeTruthy();
      // The row must be born verified. The original defect left this at the model default of
      // false while still listing and serving the image.
      expect(photo.consentVerified).toBe(true);
      expect(photo.consentVerifiedAt).toBeTruthy();
      expect(photo.consentVerifiedBy?.toString()).toBe(actorId.toString());
      // Clinical-photography consent alone never implies permission to use the image in
      // marketing (PRV-001 §16.3) — that is a separate, separately-recorded purpose.
      expect(photo.marketingConsentVerified).toBe(false);
    });

    it('records marketing image consent separately when that purpose is also granted', async () => {
      const patient = await newPatient('marketing');
      await consentService.grant(
        { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY },
        actorId
      );
      await consentService.grant(
        { patientId: patient._id, purpose: CONSENT_PURPOSE.MARKETING_IMAGE_USE },
        actorId
      );

      const photo = await upload(patient, { bodyRegion: 'chin' });

      expect(photo.consentVerified).toBe(true);
      expect(photo.marketingConsentVerified).toBe(true);
    });

    it('does not over-block routine aesthetic treatment areas', async () => {
      // Hair removal, acne and scar review legitimately photograph these. Blocking them would
      // stop real treatment documentation, so the policy deliberately excludes them.
      const patient = await newPatient('routine');
      await consentService.grant(
        { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY },
        actorId
      );

      for (const region of ['Face', 'upper back', 'abdomen', 'left thigh', 'bikini line', 'chest']) {
        const photo = await upload(patient, { bodyRegion: region });
        expect(photo.consentVerified).toBe(true);
      }
    });

    it('blocks a restricted/intimate body area even when photography consent IS granted', async () => {
      // Routine consent is not sufficient authority for intimate-area capture; clinic policy
      // requires a doctor-authorised exception workflow instead.
      const patient = await newPatient('restricted');
      await consentService.grant(
        { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY },
        actorId
      );
      const before = storageWrites.length;

      await expect(upload(patient, { bodyRegion: 'genital area' })).rejects.toMatchObject({
        statusCode: 403,
        code: 'RESTRICTED_BODY_AREA',
      });

      expect(storageWrites.length).toBe(before);
      expect(await ClinicalPhoto.countDocuments({ patientId: patient._id })).toBe(0);
    });

    it('blocks restricted-area synonyms and cosmetic spellings, not just the literal enum values', async () => {
      // A free-text region field means the defence has to live in the matcher. Casing,
      // punctuation, word order and clinical synonyms must all still trip the policy.
      const patient = await newPatient('synonyms');
      await consentService.grant(
        { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY },
        actorId
      );

      for (const region of ['Areola — left breast', 'PERIANAL', 'Scrotum', 'vulva (right)', 'natal cleft']) {
        await expect(upload(patient, { bodyRegion: region })).rejects.toMatchObject({
          code: 'RESTRICTED_BODY_AREA',
        });
      }
    });

    it('does not let "nasolabial" trip the "labial" restricted term', async () => {
      // Token-exact matching exists so a routine facial region is not mistaken for an intimate
      // one. A naive substring test would block the single most common aesthetic photo there is.
      const patient = await newPatient('nasolabial');
      await consentService.grant(
        { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY },
        actorId
      );

      const photo = await upload(patient, { bodyRegion: 'nasolabial folds' });
      expect(photo.consentVerified).toBe(true);
    });

    it('rejects a non-image upload even with full consent', async () => {
      // The multer filter is shared with document upload and also permits PDFs; a PDF must
      // never be persisted as, and later served as, a clinical photo.
      const patient = await newPatient('pdf');
      await consentService.grant(
        { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY },
        actorId
      );

      await expect(
        upload(patient, {
          file: { buffer: Buffer.from('%PDF-1.4'), originalname: 'scan.pdf', mimetype: 'application/pdf' },
        })
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_PHOTO_TYPE' });
    });
  });

  it('audits a consent-blocked capture so refusals are investigable', async () => {
    const patient = await newPatient('auditconsent');
    await expect(paths[1].upload(patient)).rejects.toThrow();

    const log = await AuditLog.findOne({
      action: AUDIT_ACTIONS.CLINICAL_PHOTO_CONSENT_MISSING,
      'metadata.patientId': patient._id.toString(),
    });
    expect(log).toBeTruthy();
  });

  it('audits a restricted-area block with the policy term that fired', async () => {
    const patient = await newPatient('auditregion');
    await consentService.grant(
      { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY },
      actorId
    );
    await expect(paths[1].upload(patient, { bodyRegion: 'Areola — left breast' })).rejects.toThrow();

    const log = await AuditLog.findOne({
      action: AUDIT_ACTIONS.RESTRICTED_PHOTO_BLOCKED,
      'metadata.bodyRegion': 'Areola — left breast',
    }).sort({ createdAt: -1 });
    expect(log).toBeTruthy();
    // Knowing WHICH policy entry fired is what makes an override request reviewable.
    expect(log.metadata.matchedRestrictedTerm).toBeTruthy();
  });

  it('re-verifying an existing photo cannot flip consentVerified without a real grant', async () => {
    // verifyPhotoConsent is a second write path to the same flag. If it trusted the request it
    // would reopen the hole from the other side.
    const patient = await newPatient('reverify');
    const consultation = await newConsultation(patient._id);
    const photo = await ClinicalPhoto.create({
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
      consultationService.verifyPhotoConsent(photo._id.toString(), actorId)
    ).rejects.toMatchObject({ code: 'PHOTOGRAPHY_CONSENT_NOT_GRANTED' });

    const unchanged = await ClinicalPhoto.findById(photo._id);
    expect(unchanged.consentVerified).toBe(false);

    await consentService.grant(
      { patientId: patient._id, purpose: CONSENT_PURPOSE.CLINICAL_PHOTOGRAPHY },
      actorId
    );
    const verified = await consultationService.verifyPhotoConsent(photo._id.toString(), actorId);
    expect(verified.consentVerified).toBe(true);
  });

  it('routes both capture paths through the one shared policy service instance type', async () => {
    // Structural guard for the actual regression: if a future change reimplements the gate
    // locally in either service, this stops matching and the drift is caught immediately.
    expect(sessionService.photoPolicy.constructor).toBe(consultationService.photoPolicy.constructor);
    expect(typeof sessionService.photoPolicy.assertCaptureAllowed).toBe('function');
  });
});
