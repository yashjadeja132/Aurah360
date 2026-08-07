import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import App from '../../src/app.js';
import Patient from '../../src/models/Patient.model.js';
import PatientDocument from '../../src/models/PatientDocument.model.js';
import PatientTokenService from '../../src/services/PatientTokenService.js';
import { PATIENT_VISIBILITY, SCAN_STATE, DOCUMENT_CATEGORY } from '../../src/enums/patient.js';
import { verifyFileToken } from '../../src/storage/LocalStorage.js';

/**
 * Task #46 — signed, expiring file-access tokens for the patient mobile app. Mirrors the
 * staff-side coverage intent for Task #24: a patient can mint a token for their own released
 * document, cannot mint (or use) one for another patient's document, and the shared
 * verification path (`verifyFileToken`) rejects malformed/expired tokens.
 */
describe('Patient file-access tokens', () => {
  let app;
  const tokenService = new PatientTokenService();
  let patientA;
  let patientB;
  let docA;
  const branchId = new mongoose.Types.ObjectId();

  function bearerFor(patient) {
    return tokenService.signAccessToken({ sub: patient._id.toString() });
  }

  beforeAll(async () => {
    await connectTestDb('patient-file-token');
    app = new App().getExpressApp();

    patientA = await Patient.create({
      mrn: `PFT-A-${Date.now()}`,
      firstName: 'Alpha',
      lastName: 'Patient',
      gender: 'FEMALE',
      mobile: '9000000001',
      primaryBranchId: branchId,
      portalEnabled: true,
      isActive: true,
      status: 'ACTIVE',
    });

    patientB = await Patient.create({
      mrn: `PFT-B-${Date.now()}`,
      firstName: 'Beta',
      lastName: 'Patient',
      gender: 'MALE',
      mobile: '9000000002',
      primaryBranchId: branchId,
      portalEnabled: true,
      isActive: true,
      status: 'ACTIVE',
    });

    docA = await PatientDocument.create({
      patientId: patientA._id,
      category: DOCUMENT_CATEGORY.OTHER,
      title: 'Alpha lab report',
      clinicalDate: new Date(),
      originalName: 'report.pdf',
      storageKey: 'misc/report.pdf',
      mimeType: 'application/pdf',
      scanState: SCAN_STATE.CLEAN,
      patientVisibility: PATIENT_VISIBILITY.RELEASED,
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  it('lets a patient mint a signed token for their own released document', async () => {
    const res = await request(app)
      .get(`/api/v1/files/patient/documents/${docA._id}/token`)
      .set('Authorization', `Bearer ${bearerFor(patientA)}`);

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.expiresAt).toBeGreaterThan(Date.now());
    expect(verifyFileToken(docA._id.toString(), res.body.token)).toBe(true);
  });

  it('refuses to mint a token for another patient\'s document', async () => {
    const res = await request(app)
      .get(`/api/v1/files/patient/documents/${docA._id}/token`)
      .set('Authorization', `Bearer ${bearerFor(patientB)}`);

    expect(res.status).toBe(403);
  });

  it('rejects an expired token at the shared verification path', () => {
    const expiredExpiresAt = Date.now() - 1000;
    // Same signing scheme as LocalStorage's signFileToken, but already in the past — the
    // helper's own `Date.now() > expiresAt` check must reject it regardless of signature.
    expect(verifyFileToken(docA._id.toString(), `${expiredExpiresAt}.deadbeef`)).toBe(false);
  });

  it('rejects a malformed token at the shared verification path', () => {
    expect(verifyFileToken(docA._id.toString(), 'not-a-real-token')).toBe(false);
    expect(verifyFileToken(docA._id.toString(), '')).toBe(false);
    expect(verifyFileToken(docA._id.toString(), null)).toBe(false);
  });

  it('rejects a well-formed but wrongly-signed token when used to fetch the file', async () => {
    const res = await request(app).get(
      `/api/v1/files/patient/documents/${docA._id}?token=${Date.now() + 60000}.deadbeef`
    );
    expect(res.status).toBe(403);
  });
});
