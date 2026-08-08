import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import App from '../../src/app.js';
import User from '../../src/models/User.model.js';
import Role from '../../src/models/Role.model.js';
import Branch from '../../src/models/Branch.model.js';
import Doctor from '../../src/models/Doctor.model.js';
import Patient from '../../src/models/Patient.model.js';
import PatientDocument from '../../src/models/PatientDocument.model.js';
import Consultation from '../../src/models/Consultation.model.js';
import LabOrder from '../../src/models/LabOrder.model.js';
import QueueEntry from '../../src/models/QueueEntry.model.js';
import TokenService from '../../src/services/TokenService.js';
import PatientTokenService from '../../src/services/PatientTokenService.js';
import { hashPassword } from '../../src/helpers/crypto.helper.js';
import { ROLE_PERMISSIONS } from '../../src/constants/rolePermissions.js';
import { ROLES, ROLE_LABELS } from '../../src/constants/roles.js';
import { PATIENT_VISIBILITY, SCAN_STATE, DOCUMENT_CATEGORY } from '../../src/enums/patient.js';

/**
 * TIER 3 — privacy and access control.
 *
 * One suite per defect, all driven over real HTTP against the real Express app so the fix is
 * proven where it must hold (the wire), not at the unit boundary:
 *
 *   1. Public waiting-room board must not SEND name/mobile (PRD §6.5/§17.2).
 *   2. Lab orders must be row-scoped, and must answer 404 — not 403 — outside scope.
 *   3. NURSE must reach its working queue, and must NOT be able to author a diagnosis.
 *   4. The patient portal must not list or download HIDDEN documents.
 *   5. Referral/guardian fields must survive the Zod layer and reach the model.
 *   6. Duplicate patients must be caught server-side, and overridable on purpose.
 */
describe('TIER 3 privacy and access control', () => {
  let app;
  const tokenService = new TokenService();
  const patientTokenService = new PatientTokenService();

  let branchA;
  let branchB;
  let doctorA;
  let doctorB;
  let tokenOwner;
  let tokenDoctorA;
  let tokenNurse;
  let tokenReceptionist;
  let patientA;
  let patientB;
  let portalPatient;
  let consultationA;
  let consultationB;
  let labOrderA;
  let labOrderB;
  let hiddenDoc;
  let releasedDoc;

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  const mintToken = async (user) =>
    tokenService.signAccessToken({
      sub: user._id.toString(),
      role: user.role,
      permissions: user.role === ROLES.OWNER ? ['*'] : ROLE_PERMISSIONS[user.role] || [],
      branch: user.branch ? user.branch.toString() : null,
    });

  const makeBranch = (code) =>
    Branch.create({
      name: `Branch ${code}`,
      displayName: `Branch ${code}`,
      branchCode: code,
      email: `${code.toLowerCase()}@tier3.test`,
      phone: '9000000000',
    });

  const makeStaffUser = async ({ email, role, branch }) =>
    User.create({
      firstName: role,
      lastName: email.split('@')[0],
      email,
      passwordHash: await hashPassword('Password@12345'),
      employeeId: `EMP-${email.split('@')[0].toUpperCase()}`,
      role,
      branch: branch || null,
      isActive: true,
      status: 'ACTIVE',
    });

  const makeConsultation = (number, { patient, doctor, branch }) =>
    Consultation.create({
      consultationNumber: number,
      appointmentId: new mongoose.Types.ObjectId(),
      patientId: patient._id,
      doctorId: doctor._id,
      branchId: branch._id,
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    });

  beforeAll(async () => {
    await connectTestDb('tier3');
    app = new App().getExpressApp();

    for (const code of [ROLES.OWNER, ROLES.DOCTOR, ROLES.NURSE, ROLES.RECEPTIONIST]) {
      await Role.findOneAndUpdate(
        { code },
        {
          code,
          name: ROLE_LABELS[code],
          permissions: code === ROLES.OWNER ? ['*'] : ROLE_PERMISSIONS[code],
          isSystem: true,
          isActive: true,
        },
        { upsert: true }
      );
    }

    branchA = await makeBranch('T3-A');
    branchB = await makeBranch('T3-B');

    const userDoctorA = await makeStaffUser({
      email: 't3.doctor.a@test.local',
      role: ROLES.DOCTOR,
      branch: branchA._id,
    });
    const userDoctorB = await makeStaffUser({
      email: 't3.doctor.b@test.local',
      role: ROLES.DOCTOR,
      branch: branchB._id,
    });
    const owner = await makeStaffUser({ email: 't3.owner@test.local', role: ROLES.OWNER });
    const nurse = await makeStaffUser({
      email: 't3.nurse@test.local',
      role: ROLES.NURSE,
      branch: branchA._id,
    });
    const receptionist = await makeStaffUser({
      email: 't3.reception@test.local',
      role: ROLES.RECEPTIONIST,
      branch: branchA._id,
    });

    doctorA = await Doctor.create({
      userId: userDoctorA._id,
      doctorCode: 'T3-A',
      licenseNumber: 'LIC-T3A',
      registrationNumber: 'REG-T3A',
    });
    doctorB = await Doctor.create({
      userId: userDoctorB._id,
      doctorCode: 'T3-B',
      licenseNumber: 'LIC-T3B',
      registrationNumber: 'REG-T3B',
    });

    tokenOwner = await mintToken(owner);
    tokenDoctorA = await mintToken(userDoctorA);
    tokenNurse = await mintToken(nurse);
    tokenReceptionist = await mintToken(receptionist);

    patientA = await Patient.create({
      mrn: 'T3-P-A',
      firstName: 'Anita',
      lastName: 'Sharma',
      gender: 'FEMALE',
      mobile: '9811100001',
      primaryBranchId: branchA._id,
    });
    patientB = await Patient.create({
      mrn: 'T3-P-B',
      firstName: 'Bhavin',
      lastName: 'Patel',
      gender: 'MALE',
      mobile: '9811100002',
      primaryBranchId: branchB._id,
    });
    portalPatient = await Patient.create({
      mrn: 'T3-P-PORTAL',
      firstName: 'Priya',
      lastName: 'Nair',
      gender: 'FEMALE',
      mobile: '9811100003',
      primaryBranchId: branchA._id,
      portalEnabled: true,
      isActive: true,
      status: 'ACTIVE',
    });

    consultationA = await makeConsultation('T3-CON-A', {
      patient: patientA,
      doctor: doctorA,
      branch: branchA,
    });
    consultationB = await makeConsultation('T3-CON-B', {
      patient: patientB,
      doctor: doctorB,
      branch: branchB,
    });

    labOrderA = await LabOrder.create({
      consultationId: consultationA._id,
      patientId: patientA._id,
      testName: 'CBC',
      orderedBy: userDoctorA._id,
    });
    labOrderB = await LabOrder.create({
      consultationId: consultationB._id,
      patientId: patientB._id,
      testName: 'Vitamin D',
      orderedBy: userDoctorB._id,
    });

    await QueueEntry.create({
      tokenNumber: 'T3-001',
      appointmentId: new mongoose.Types.ObjectId(),
      patientId: patientA._id,
      doctorId: doctorA._id,
      branchId: branchA._id,
      queueDate: new Date(),
      receptionNotes: 'Patient is anxious',
    });

    hiddenDoc = await PatientDocument.create({
      patientId: portalPatient._id,
      category: DOCUMENT_CATEGORY.OTHER,
      title: 'Draft biopsy result — not released',
      clinicalDate: new Date(),
      originalName: 'biopsy.pdf',
      storageKey: 'misc/biopsy.pdf',
      mimeType: 'application/pdf',
      scanState: SCAN_STATE.CLEAN,
      patientVisibility: PATIENT_VISIBILITY.HIDDEN,
    });
    releasedDoc = await PatientDocument.create({
      patientId: portalPatient._id,
      category: DOCUMENT_CATEGORY.OTHER,
      title: 'Discharge summary',
      clinicalDate: new Date(),
      originalName: 'summary.pdf',
      storageKey: 'misc/summary.pdf',
      mimeType: 'application/pdf',
      scanState: SCAN_STATE.CLEAN,
      patientVisibility: PATIENT_VISIBILITY.RELEASED,
    });
    // This suite covers six defects, so its fixture set is larger than the default 10s hook
    // budget allows against a remote cluster.
  }, 60000);

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  // ─── 1. Public queue board ────────────────────────────────────────────────
  describe('public waiting-room board', () => {
    it('omits patient name and mobile from the public board payload', async () => {
      const res = await request(app)
        .get(`/api/v1/queue/branch?branchId=${branchA._id}&view=PUBLIC`)
        .set(auth(tokenReceptionist));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      const [entry] = res.body.data;
      expect(entry.tokenNumber).toBe('T3-001');
      expect(entry.patientInitials).toBe('AS');
      // Asserted on the SERIALISED body, not on the parsed row: the defect was that identity
      // reached the browser at all, so nothing identifying may appear anywhere in the payload.
      const wire = JSON.stringify(res.body);
      expect(wire).not.toContain('Anita');
      expect(wire).not.toContain('Sharma');
      expect(wire).not.toContain('9811100001');
      expect(wire).not.toContain('Patient is anxious');
      expect(entry.patient).toBeUndefined();
      expect(entry.patientId).toBeUndefined();
    });

    it('still gives the staff board the full patient record', async () => {
      const res = await request(app)
        .get(`/api/v1/queue/branch?branchId=${branchA._id}`)
        .set(auth(tokenReceptionist));

      expect(res.status).toBe(200);
      expect(res.body.data[0].patient.fullName).toBe('Anita Sharma');
      expect(res.body.data[0].patient.mobile).toBe('9811100001');
    });
  });

  // ─── 2. Lab order IDOR ────────────────────────────────────────────────────
  describe('lab order scoping', () => {
    it('answers 404 (not 403) when reading lab orders of an out-of-scope consultation', async () => {
      const res = await request(app)
        .get(`/api/v1/consultations/${consultationB._id}/lab-orders`)
        .set(auth(tokenDoctorA));

      expect(res.status).toBe(404);
    });

    it('refuses to mutate an out-of-scope lab order', async () => {
      const res = await request(app)
        .patch(`/api/v1/consultations/${consultationB._id}/lab-orders/${labOrderB._id}`)
        .set(auth(tokenDoctorA))
        .send({ status: 'RESULT_RECEIVED' });

      expect(res.status).toBe(404);
      const unchanged = await LabOrder.findById(labOrderB._id);
      expect(unchanged.status).toBe('ORDERED');
    });

    it('still serves a doctor their own lab orders', async () => {
      const res = await request(app)
        .get(`/api/v1/consultations/${consultationA._id}/lab-orders`)
        .set(auth(tokenDoctorA));

      expect(res.status).toBe(200);
      expect(res.body.data.orders.map((o) => o.id)).toContain(labOrderA._id.toString());
    });

    it('leaves OWNER unrestricted across branches', async () => {
      const res = await request(app)
        .get(`/api/v1/consultations/${consultationB._id}/lab-orders`)
        .set(auth(tokenOwner));

      expect(res.status).toBe(200);
      expect(res.body.data.orders).toHaveLength(1);
    });
  });

  // ─── 3. Nurse role ────────────────────────────────────────────────────────
  describe('nurse role', () => {
    it('can load the branch list its queue screen resolves a branch from', async () => {
      const res = await request(app).get('/api/v1/branches').set(auth(tokenNurse));
      expect(res.status).toBe(200);
    });

    it('can read its working queue', async () => {
      const res = await request(app)
        .get(`/api/v1/queue/branch?branchId=${branchA._id}`)
        .set(auth(tokenNurse));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('can record vitals', async () => {
      const res = await request(app)
        .put(`/api/v1/consultations/${consultationA._id}/vitals`)
        .set(auth(tokenNurse))
        .send({ pulse: 72 });

      expect(res.status).toBe(200);
    });

    it('cannot author a diagnosis', async () => {
      const res = await request(app)
        .put(`/api/v1/consultations/${consultationA._id}/diagnosis`)
        .set(auth(tokenNurse))
        .send({ provisionalDiagnosis: 'Melasma' });

      expect(res.status).toBe(403);
    });

    it('cannot author a prescription', async () => {
      const res = await request(app)
        .post('/api/v1/prescriptions')
        .set(auth(tokenNurse))
        .send({ consultationId: consultationA._id.toString() });

      expect(res.status).toBe(403);
    });

    it('leaves diagnosis authoring working for the doctor', async () => {
      const res = await request(app)
        .put(`/api/v1/consultations/${consultationA._id}/diagnosis`)
        .set(auth(tokenDoctorA))
        .send({ provisionalDiagnosis: 'Melasma' });

      expect(res.status).toBe(200);
    });
  });

  // ─── 4. Portal hidden documents ───────────────────────────────────────────
  describe('patient portal document visibility', () => {
    const portalAuth = () => ({
      Authorization: `Bearer ${patientTokenService.signAccessToken({ sub: portalPatient._id.toString() })}`,
    });

    it('does not list documents flagged HIDDEN', async () => {
      const res = await request(app).get('/api/v1/patient/documents').set(portalAuth());

      expect(res.status).toBe(200);
      const ids = res.body.data.map((d) => d.id);
      expect(ids).toContain(releasedDoc._id.toString());
      expect(ids).not.toContain(hiddenDoc._id.toString());
      // Even the TITLE of an unreleased document is a disclosure.
      expect(JSON.stringify(res.body)).not.toContain('Draft biopsy result');
    });

    it('refuses to resolve a HIDDEN document for download', async () => {
      const res = await request(app)
        .get(`/api/v1/patient/documents/${hiddenDoc._id}/download`)
        .set(portalAuth());

      expect(res.status).toBe(404);
    });

    it('still serves a released document', async () => {
      const res = await request(app)
        .get(`/api/v1/patient/documents/${releasedDoc._id}/download`)
        .set(portalAuth());

      expect(res.status).toBe(200);
    });
  });

  // ─── 5. Zod-stripped referral / guardian fields ───────────────────────────
  describe('referral and guardian fields', () => {
    it('persists sourceCategory, campaign and guardian details through the validator', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set(auth(tokenOwner))
        .send({
          firstName: 'Referral',
          lastName: 'Field',
          gender: 'FEMALE',
          mobile: '9822200001',
          primaryBranchId: branchA._id.toString(),
          sourceCategory: 'INSTAGRAM_AD',
          campaign: 'Diwali-2026',
          isDependent: true,
          guardianName: 'Meera Field',
          guardianRelationship: 'MOTHER',
          guardianPhone: '9822200099',
        });

      expect(res.status).toBe(201);

      // Read back from the DATABASE, not the response: the defect was silent data loss at write
      // time, and a response echoing the request would hide it.
      const saved = await Patient.findById(res.body.data.patient.id);
      expect(saved.sourceCategory).toBe('INSTAGRAM_AD');
      expect(saved.campaign).toBe('Diwali-2026');
      expect(saved.isDependent).toBe(true);
      expect(saved.guardianName).toBe('Meera Field');
      expect(saved.guardianRelationship).toBe('MOTHER');
      expect(saved.guardianPhone).toBe('9822200099');
    });

    it('never lets a client self-assert guardianVerified', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set(auth(tokenOwner))
        .send({
          firstName: 'Unverified',
          lastName: 'Guardian',
          gender: 'MALE',
          mobile: '9822200002',
          primaryBranchId: branchA._id.toString(),
          guardianName: 'Someone',
          guardianVerified: true,
        });

      expect(res.status).toBe(201);
      const saved = await Patient.findById(res.body.data.patient.id);
      expect(saved.guardianVerified).toBe(false);
    });
  });

  // ─── 6. Server-side duplicate detection ───────────────────────────────────
  describe('server-side duplicate patient detection', () => {
    const basePatient = (overrides = {}) => ({
      firstName: 'Dup',
      lastName: 'Candidate',
      gender: 'FEMALE',
      mobile: '9833300001',
      dateOfBirth: '1990-04-01',
      primaryBranchId: branchA._id.toString(),
      ...overrides,
    });

    it('creates the first record normally', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set(auth(tokenOwner))
        .send(basePatient());
      expect(res.status).toBe(201);
    });

    it('rejects a second create on the same mobile, naming the existing patient', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set(auth(tokenOwner))
        .send(basePatient({ firstName: 'Someone', lastName: 'Else', dateOfBirth: null }));

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PATIENT_DUPLICATE_SUSPECTED');
      expect(res.body.errors.matches[0].mrn).toBeTruthy();
      expect(res.body.errors.matches[0].matchReasons).toContain('PHONE');
      expect(res.body.errors.likelyMatchId).toBeTruthy();
    });

    it('rejects a second create on the same name + date of birth', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set(auth(tokenOwner))
        .send(basePatient({ mobile: '9833300099' }));

      expect(res.status).toBe(409);
      expect(res.body.errors.matches[0].matchReasons).toContain('NAME_DOB');
    });

    it('lets the clinic override deliberately — families do share a phone number', async () => {
      const res = await request(app)
        .post('/api/v1/patients')
        .set(auth(tokenOwner))
        .send(basePatient({ firstName: 'Sibling', dateOfBirth: '2015-02-02', allowDuplicate: true }));

      expect(res.status).toBe(201);
      // The override flag is a control instruction, never a stored patient attribute.
      const saved = await Patient.findById(res.body.data.patient.id).lean();
      expect(saved.allowDuplicate).toBeUndefined();
      expect(saved.mobile).toBe('9833300001');
    });
  });
});
