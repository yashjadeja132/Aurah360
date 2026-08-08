import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import App from '../../src/app.js';
import config from '../../src/config/index.js';
import User from '../../src/models/User.model.js';
import Patient from '../../src/models/Patient.model.js';
import Appointment from '../../src/models/Appointment.model.js';
import PatientDocument from '../../src/models/PatientDocument.model.js';
import ClinicalPhoto from '../../src/models/ClinicalPhoto.model.js';
import AuditLog from '../../src/models/AuditLog.model.js';
import AiRun from '../../src/models/AiRun.model.js';
import CashClose from '../../src/models/CashClose.model.js';
import FeeSchedule from '../../src/models/FeeSchedule.model.js';
import ConsentGrant from '../../src/models/ConsentGrant.model.js';
import PrivacyRequest from '../../src/models/PrivacyRequest.model.js';
import LoyaltyLedgerEntry from '../../src/models/LoyaltyLedgerEntry.model.js';
import TokenService from '../../src/services/TokenService.js';
import PatientTokenService from '../../src/services/PatientTokenService.js';
import { hashPassword } from '../../src/helpers/crypto.helper.js';
import { ROLE_PERMISSIONS } from '../../src/constants/rolePermissions.js';
import { ROLES } from '../../src/constants/roles.js';
import { PATIENT_VISIBILITY, SCAN_STATE, DOCUMENT_CATEGORY } from '../../src/enums/patient.js';
import { AUDIT_ACTIONS } from '../../src/enums/auditAction.js';

/**
 * SEC-030 — patient-anchored row scoping for the endpoints that previously had none, and the
 * staff file-access hole in particular.
 *
 * Every case is asserted in BOTH directions. A scope that returns 404 for everything is an
 * outage, not a fix, so each "refused another branch's data" test is paired with a "still gets
 * their own" test, plus OWNER-sees-everything and patient-still-reaches-their-own-files.
 *
 * The cross-branch patient (`patRoam`, registered at B but seen at A) is the anti-over-scoping
 * case: naive `primaryBranchId` pinning would hide a patient from the branch actually treating
 * them.
 */
describe('SEC-030 patient-anchored scoping (files, loyalty, consent, privacy, AI, billing ops)', () => {
  let app;
  const tokenService = new TokenService();
  const patientTokenService = new PatientTokenService();

  let branchA;
  let branchB;
  let tokenOwner;
  let tokenDoctorA;
  let tokenNurseA;
  let tokenManagerA;
  let userDoctorA;
  let userDoctorB;

  let patA;
  let patB;
  let patRoam;

  let docA;
  let docB;
  let docRoam;
  let photoA;
  let photoB;

  const uploadRoot = path.resolve(config.storage.localPath);
  const fixtureDir = path.join(uploadRoot, 'a360t-filescope');

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  const mintToken = (user) =>
    tokenService.signAccessToken({
      sub: user._id.toString(),
      role: user.role,
      permissions: user.role === ROLES.OWNER ? ['*'] : ROLE_PERMISSIONS[user.role] || [],
      branch: user.branch ? user.branch.toString() : null,
    });

  const makeUser = async ({ email, role, branch }) =>
    User.create({
      firstName: role,
      lastName: email.split('@')[0],
      email,
      passwordHash: await hashPassword('Password@12345'),
      employeeId: `FS-${email.split('@')[0].toUpperCase()}`,
      role,
      branch: branch || null,
      isActive: true,
      status: 'ACTIVE',
    });

  const makePatient = async (code, branchId) =>
    Patient.create({
      mrn: `FS-${code}-${Date.now()}`,
      firstName: code,
      lastName: 'Patient',
      gender: 'FEMALE',
      mobile: `90000000${code.length}${Math.floor(Math.random() * 90) + 10}`,
      primaryBranchId: branchId,
      portalEnabled: true,
      isActive: true,
      status: 'ACTIVE',
    });

  const makeDocument = async (patient, label) => {
    const storageKey = `a360t-filescope/${label}.txt`;
    await fs.writeFile(path.join(uploadRoot, storageKey), `bytes for ${label}`);
    return PatientDocument.create({
      patientId: patient._id,
      category: DOCUMENT_CATEGORY.OTHER,
      title: `${label} report`,
      clinicalDate: new Date(),
      originalName: `${label}.txt`,
      storageKey,
      mimeType: 'text/plain',
      scanState: SCAN_STATE.CLEAN,
      patientVisibility: PATIENT_VISIBILITY.RELEASED,
    });
  };

  const makePhoto = async (patient, label) => {
    const storageKey = `a360t-filescope/${label}.txt`;
    await fs.writeFile(path.join(uploadRoot, storageKey), `pixels for ${label}`);
    return ClinicalPhoto.create({
      consultationId: new mongoose.Types.ObjectId(),
      patientId: patient._id,
      storageKey,
      originalName: `${label}.txt`,
      mimeType: 'text/plain',
      scanState: SCAN_STATE.CLEAN,
      consentVerified: true,
      patientVisibility: PATIENT_VISIBILITY.RELEASED,
    });
  };

  beforeAll(async () => {
    await connectTestDb('filescope');
    app = new App().getExpressApp();
    await fs.mkdir(fixtureDir, { recursive: true });

    /**
     * Branch and Doctor rows are represented by bare ObjectIds. Nothing under test dereferences
     * them (scoping compares ids), and this test cluster sits on a hard 500-collection ceiling —
     * every collection a suite does not need is one another suite can have.
     */
    branchA = { _id: new mongoose.Types.ObjectId() };
    branchB = { _id: new mongoose.Types.ObjectId() };

    const owner = await makeUser({ email: 'owner@filescope.test', role: ROLES.OWNER, branch: branchA._id });
    userDoctorA = await makeUser({ email: 'doca@filescope.test', role: ROLES.DOCTOR, branch: branchA._id });
    userDoctorB = await makeUser({ email: 'docb@filescope.test', role: ROLES.DOCTOR, branch: branchB._id });
    const nurseA = await makeUser({ email: 'nursea@filescope.test', role: ROLES.NURSE, branch: branchA._id });
    const managerA = await makeUser({
      email: 'bma@filescope.test',
      role: ROLES.BRANCH_MANAGER,
      branch: branchA._id,
    });

    tokenOwner = mintToken(owner);
    tokenDoctorA = mintToken(userDoctorA);
    tokenNurseA = mintToken(nurseA);
    tokenManagerA = mintToken(managerA);

    const doctorProfileA = { _id: new mongoose.Types.ObjectId() };

    patA = await makePatient('AAA', branchA._id);
    patB = await makePatient('BBB', branchB._id);
    // Registered at B, but actually seen at A — must stay readable to branch A staff.
    patRoam = await makePatient('ROAM', branchB._id);
    await Appointment.create({
      appointmentNumber: `FS-APPT-${Date.now()}`,
      patientId: patRoam._id,
      doctorId: doctorProfileA._id,
      branchId: branchA._id,
      serviceId: new mongoose.Types.ObjectId(),
      appointmentDate: new Date(),
      startTime: '10:00',
      endTime: '10:15',
    });

    [docA, docB, docRoam, photoA, photoB] = await Promise.all([
      makeDocument(patA, 'doc-a'),
      makeDocument(patB, 'doc-b'),
      makeDocument(patRoam, 'doc-roam'),
      makePhoto(patA, 'photo-a'),
      makePhoto(patB, 'photo-b'),
    ]);

    // --- non-file fixtures -------------------------------------------------
    await AiRun.create([
      {
        useCase: 'CLINICAL_COPILOT',
        requestedBy: userDoctorA._id,
        provider: 'test',
        model: 'test-model',
        inputManifest: { note: 'branch A run' },
        status: 'SUCCESS',
      },
      {
        useCase: 'CLINICAL_COPILOT',
        requestedBy: userDoctorB._id,
        provider: 'test',
        model: 'test-model',
        inputManifest: { note: 'branch B run' },
        status: 'SUCCESS',
      },
    ]);

    await CashClose.create([
      {
        branchId: branchA._id,
        closeDate: new Date('2026-01-01'),
        openingCash: 0,
        cashCollected: 100,
        countedCash: 100,
        expectedCash: 100,
        variance: 0,
        submittedBy: userDoctorA._id,
      },
      {
        branchId: branchB._id,
        closeDate: new Date('2026-01-01'),
        openingCash: 0,
        cashCollected: 200,
        countedCash: 200,
        expectedCash: 200,
        variance: 0,
        submittedBy: userDoctorB._id,
      },
    ]);

    await FeeSchedule.create([
      { serviceId: new mongoose.Types.ObjectId(), branchId: branchA._id, price: 111, effectiveFrom: new Date('2020-01-01') },
      { serviceId: new mongoose.Types.ObjectId(), branchId: branchB._id, price: 222, effectiveFrom: new Date('2020-01-01') },
      // Organisation-wide default — must remain visible to a branch-scoped caller.
      { serviceId: new mongoose.Types.ObjectId(), branchId: null, price: 333, effectiveFrom: new Date('2020-01-01') },
    ]);

    await ConsentGrant.create([
      { patientId: patA._id, purpose: 'CLINICAL_PHOTOGRAPHY', state: 'GRANTED' },
      { patientId: patB._id, purpose: 'CLINICAL_PHOTOGRAPHY', state: 'GRANTED' },
    ]);

    await PrivacyRequest.create([
      { patientId: patA._id, type: 'ACCESS', dueDate: new Date('2026-12-31') },
      { patientId: patB._id, type: 'ACCESS', dueDate: new Date('2026-12-31') },
    ]);

    // Points earned at BRANCH B for a patient branch A also treats — the cross-branch balance
    // that a naive branchId pin on the ledger would have hidden from branch A.
    await LoyaltyLedgerEntry.create({
      branchId: branchB._id,
      patientId: patRoam._id,
      entryType: 'CREDIT',
      points: 50,
    });
  });

  afterAll(async () => {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await dropTestDb();
    await disconnectTestDb();
  });

  // --- staff file access ---------------------------------------------------

  it('refuses another branch patient\'s document with 404, not 403', async () => {
    const res = await request(app).get(`/api/v1/files/documents/${docB._id}`).set(auth(tokenDoctorA));
    expect(res.status).toBe(404);
  });

  it('refuses another branch patient\'s clinical photo with 404, not 403', async () => {
    const res = await request(app).get(`/api/v1/files/photos/${photoB._id}`).set(auth(tokenDoctorA));
    expect(res.status).toBe(404);
  });

  it('refuses to mint a file token for another branch patient\'s document', async () => {
    const res = await request(app).get(`/api/v1/files/documents/${docB._id}/token`).set(auth(tokenDoctorA));
    expect(res.status).toBe(404);
  });

  it('still serves a document for a patient at the caller\'s own branch', async () => {
    const res = await request(app).get(`/api/v1/files/documents/${docA._id}`).set(auth(tokenDoctorA));
    expect(res.status).toBe(200);
    expect(res.text).toContain('bytes for doc-a');
  });

  it('still serves a clinical photo for a patient at the caller\'s own branch', async () => {
    const res = await request(app).get(`/api/v1/files/photos/${photoA._id}`).set(auth(tokenDoctorA));
    expect(res.status).toBe(200);
  });

  it('serves a visiting patient\'s document to the branch that actually treated them', async () => {
    // patRoam is registered at branch B; branch A only has an appointment for them.
    const res = await request(app).get(`/api/v1/files/documents/${docRoam._id}`).set(auth(tokenDoctorA));
    expect(res.status).toBe(200);
  });

  it('leaves OWNER unrestricted across branches', async () => {
    const [a, b] = await Promise.all([
      request(app).get(`/api/v1/files/documents/${docA._id}`).set(auth(tokenOwner)),
      request(app).get(`/api/v1/files/documents/${docB._id}`).set(auth(tokenOwner)),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
  });

  // --- download vs view ----------------------------------------------------

  it('lets a view-only role (NURSE) view a file but not download a copy', async () => {
    const view = await request(app).get(`/api/v1/files/documents/${docA._id}`).set(auth(tokenNurseA));
    expect(view.status).toBe(200);
    expect(view.headers['content-disposition']).toContain('inline');

    const download = await request(app)
      .get(`/api/v1/files/documents/${docA._id}?download=1`)
      .set(auth(tokenNurseA));
    expect(download.status).toBe(403);
    expect(download.body.code || download.body.error?.code).toBe('FILE_DOWNLOAD_NOT_PERMITTED');
  });

  it('lets a download-permitted role (DOCTOR) take a copy as an attachment', async () => {
    const res = await request(app)
      .get(`/api/v1/files/documents/${docA._id}?download=1`)
      .set(auth(tokenDoctorA));
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  // --- patient portal ------------------------------------------------------

  it('still lets the patient read their own released document, and now audits it', async () => {
    const bearer = patientTokenService.signAccessToken({ sub: patA._id.toString() });
    const res = await request(app)
      .get(`/api/v1/files/patient/documents/${docA._id}`)
      .set('Authorization', `Bearer ${bearer}`);
    expect(res.status).toBe(200);

    const audit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.PATIENT_DOCUMENT_DOWNLOADED,
      'metadata.channel': 'PATIENT_PORTAL',
      'metadata.documentId': docA._id.toString(),
    });
    expect(audit).toBeTruthy();
  });

  it('still lets the patient read their own released photo, and now audits it', async () => {
    const bearer = patientTokenService.signAccessToken({ sub: patA._id.toString() });
    const res = await request(app)
      .get(`/api/v1/files/patient/photos/${photoA._id}`)
      .set('Authorization', `Bearer ${bearer}`);
    expect(res.status).toBe(200);

    const audit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.PATIENT_DOCUMENT_DOWNLOADED,
      'metadata.channel': 'PATIENT_PORTAL',
      'metadata.photoId': photoA._id.toString(),
    });
    expect(audit).toBeTruthy();
  });

  // --- loyalty -------------------------------------------------------------

  it('refuses another branch patient\'s loyalty balance with 404', async () => {
    const res = await request(app).get(`/api/v1/loyalty/patients/${patB._id}/balance`).set(auth(tokenDoctorA));
    expect(res.status).toBe(404);
  });

  it('returns the FULL cross-branch balance for a patient the caller does treat', async () => {
    // The 50 points were earned at BRANCH B. A branch-A caller must still be handed that entry —
    // if the ledger were pinned to the caller's branch it would vanish here and redemption at
    // branch A would short-change the patient.
    const [balance, ledger] = await Promise.all([
      request(app).get(`/api/v1/loyalty/patients/${patRoam._id}/balance`).set(auth(tokenDoctorA)),
      request(app).get(`/api/v1/loyalty/patients/${patRoam._id}/ledger`).set(auth(tokenDoctorA)),
    ]);
    expect(balance.status).toBe(200);
    expect(ledger.status).toBe(200);
    expect(ledger.body.data.some((e) => e.points === 50)).toBe(true);
  });

  it('scopes the loyalty adjustment queue to the caller\'s branch', async () => {
    const res = await request(app).get('/api/v1/loyalty/adjustments/queue').set(auth(tokenManagerA));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // --- consent -------------------------------------------------------------

  it('refuses another branch patient\'s consent record with 404', async () => {
    const res = await request(app).get(`/api/v1/consent/patients/${patB._id}`).set(auth(tokenDoctorA));
    expect(res.status).toBe(404);
  });

  it('still returns consent for a patient the caller treats, wherever it was recorded', async () => {
    const res = await request(app).get(`/api/v1/consent/patients/${patA._id}`).set(auth(tokenDoctorA));
    expect(res.status).toBe(200);
  });

  it('leaves OWNER able to read any patient\'s consent', async () => {
    const res = await request(app).get(`/api/v1/consent/patients/${patB._id}`).set(auth(tokenOwner));
    expect(res.status).toBe(200);
  });

  // --- privacy requests ----------------------------------------------------

  it('drops other branches\' privacy requests from the list but keeps its own', async () => {
    const res = await request(app).get('/api/v1/privacy/requests').set(auth(tokenManagerA));
    expect(res.status).toBe(200);
    const ids = res.body.data.requests.map((r) => r.patientId);
    expect(ids).toContain(patA._id.toString());
    expect(ids).not.toContain(patB._id.toString());
  });

  it('leaves OWNER seeing every branch\'s privacy requests', async () => {
    const res = await request(app).get('/api/v1/privacy/requests').set(auth(tokenOwner));
    expect(res.status).toBe(200);
    const ids = res.body.data.requests.map((r) => r.patientId);
    expect(ids).toContain(patA._id.toString());
    expect(ids).toContain(patB._id.toString());
  });

  // --- AI runs -------------------------------------------------------------

  it('scopes the AI run governance list to the caller\'s branch', async () => {
    const res = await request(app).get('/api/v1/ai/runs').set(auth(tokenManagerA));
    expect(res.status).toBe(200);
    const requesters = res.body.data.runs.map((r) => r.requestedBy);
    expect(requesters).toContain(userDoctorA._id.toString());
    expect(requesters).not.toContain(userDoctorB._id.toString());
  });

  it('leaves OWNER seeing AI runs from every branch', async () => {
    const res = await request(app).get('/api/v1/ai/runs').set(auth(tokenOwner));
    expect(res.status).toBe(200);
    const requesters = res.body.data.runs.map((r) => r.requestedBy);
    expect(requesters).toContain(userDoctorA._id.toString());
    expect(requesters).toContain(userDoctorB._id.toString());
  });

  // --- billing ops ---------------------------------------------------------

  it('scopes the cash-close list to the caller\'s branch', async () => {
    const res = await request(app).get('/api/v1/billing-ops/cash-close').set(auth(tokenManagerA));
    expect(res.status).toBe(200);
    const branches = res.body.data.closes.map((c) => c.branchId);
    expect(branches).toContain(branchA._id.toString());
    expect(branches).not.toContain(branchB._id.toString());
  });

  it('leaves OWNER seeing every branch\'s cash closes', async () => {
    const res = await request(app).get('/api/v1/billing-ops/cash-close').set(auth(tokenOwner));
    expect(res.status).toBe(200);
    const branches = res.body.data.closes.map((c) => c.branchId);
    expect(branches).toEqual(expect.arrayContaining([branchA._id.toString(), branchB._id.toString()]));
  });

  it('hides other branches\' fee schedules but keeps org-wide defaults visible', async () => {
    const res = await request(app).get('/api/v1/billing-ops/fee-schedules').set(auth(tokenManagerA));
    expect(res.status).toBe(200);
    const branches = res.body.data.feeSchedules.map((f) => f.branchId);
    expect(branches).toContain(branchA._id.toString());
    expect(branches).toContain(null); // the organisation-wide default price
    expect(branches).not.toContain(branchB._id.toString());
  });
});
