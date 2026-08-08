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
import Master from '../../src/models/Master.model.js';
import Patient from '../../src/models/Patient.model.js';
import Appointment from '../../src/models/Appointment.model.js';
import Consultation from '../../src/models/Consultation.model.js';
import TokenService from '../../src/services/TokenService.js';
import { hashPassword } from '../../src/helpers/crypto.helper.js';
import { ROLE_PERMISSIONS } from '../../src/constants/rolePermissions.js';
import { ROLES, ROLE_LABELS } from '../../src/constants/roles.js';

/**
 * SEC-030 — row-level (data) scoping on list endpoints.
 *
 * Regression cover for the reported defect: a DOCTOR holding plain `patients.view` /
 * `appointments.view` was served every patient in the organisation and every OTHER doctor's
 * appointments, because the list endpoints applied no row-level filter and honoured whatever
 * `doctorId` the client sent.
 *
 * Proves three things over real HTTP against the real Express app:
 *   1. Doctor A's list endpoints contain only Doctor A's rows — never Doctor B's.
 *   2. A client-supplied out-of-scope `doctorId`/`branchId` is REJECTED, not honoured.
 *   3. OWNER still sees everything (the fix must not become an outage for the org's owner).
 *
 * Access tokens are minted directly with TokenService rather than driven through /auth/login:
 * the payload is byte-identical to what AuthService#buildAccessPayload issues, and it keeps the
 * suite independent of whether OWNER is in config.security.mfaRequiredRoles in a given env.
 */
describe('SEC-030 row-level scoping', () => {
  let app;
  const tokenService = new TokenService();

  let branchA;
  let branchB;
  let doctorA;
  let doctorB;
  let tokenDoctorA;
  let tokenDoctorB;
  let tokenOwner;
  let apptA;
  let apptB;

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  const mintToken = async (user) => {
    const permissions =
      user.role === ROLES.OWNER ? ['*'] : ROLE_PERMISSIONS[user.role] || [];
    return tokenService.signAccessToken({
      sub: user._id.toString(),
      role: user.role,
      permissions,
      branch: user.branch ? user.branch.toString() : null,
    });
  };

  const makeBranch = (code) =>
    Branch.create({
      name: `Branch ${code}`,
      displayName: `Branch ${code}`,
      branchCode: code,
      email: `${code.toLowerCase()}@scoping.test`,
      phone: '9000000000',
    });

  const makeStaffUser = async ({ email, role, branch }) =>
    User.create({
      firstName: role,
      lastName: email.split('@')[0],
      email,
      passwordHash: await hashPassword('Password@12345'),
      // employeeId carries a unique index, so a null would collide across fixtures.
      employeeId: `EMP-${email.split('@')[0].toUpperCase()}`,
      role,
      branch: branch || null,
      isActive: true,
      status: 'ACTIVE',
    });

  const makeDoctor = async (user, code) =>
    Doctor.create({
      userId: user._id,
      doctorCode: code,
      licenseNumber: `LIC-${code}`,
      registrationNumber: `REG-${code}`,
    });

  const makePatient = async (mrn, branchId) =>
    Patient.create({
      mrn,
      firstName: 'Pat',
      lastName: mrn,
      gender: 'FEMALE',
      mobile: `98${mrn.replace(/\D/g, '').padStart(8, '0')}`.slice(0, 10),
      primaryBranchId: branchId,
    });

  beforeAll(async () => {
    await connectTestDb('role-scoping');
    app = new App().getExpressApp();

    for (const code of [ROLES.OWNER, ROLES.DOCTOR]) {
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

    branchA = await makeBranch('SCOPE-A');
    branchB = await makeBranch('SCOPE-B');

    const userA = await makeStaffUser({
      email: 'scope.doctor.a@test.local',
      role: ROLES.DOCTOR,
      branch: branchA._id,
    });
    const userB = await makeStaffUser({
      email: 'scope.doctor.b@test.local',
      role: ROLES.DOCTOR,
      branch: branchA._id, // SAME branch — so only doctor scoping can separate them
    });
    // OWNER is intentionally branch-less: OWNER/ADMIN are the two roles that span all branches.
    const owner = await makeStaffUser({ email: 'scope.owner@test.local', role: ROLES.OWNER });

    doctorA = await makeDoctor(userA, 'SC-A');
    doctorB = await makeDoctor(userB, 'SC-B');

    tokenDoctorA = await mintToken(userA);
    tokenDoctorB = await mintToken(userB);
    tokenOwner = await mintToken(owner);

    const service = await Master.create({ type: 'SERVICE', name: 'Scoping Consult' });
    const patientA = await makePatient('MRN-SCOPE-A', branchA._id);
    const patientB = await makePatient('MRN-SCOPE-B', branchA._id);
    const patientOther = await makePatient('MRN-SCOPE-C', branchB._id);

    const baseAppt = {
      serviceId: service._id,
      appointmentDate: new Date(),
      startTime: '10:00',
      endTime: '10:30',
    };
    apptA = await Appointment.create({
      ...baseAppt,
      appointmentNumber: 'APT-SCOPE-A',
      patientId: patientA._id,
      doctorId: doctorA._id,
      branchId: branchA._id,
    });
    apptB = await Appointment.create({
      ...baseAppt,
      appointmentNumber: 'APT-SCOPE-B',
      patientId: patientB._id,
      doctorId: doctorB._id,
      branchId: branchA._id,
    });
    // A third appointment in ANOTHER branch, so branch scoping is observable independently.
    await Appointment.create({
      ...baseAppt,
      appointmentNumber: 'APT-SCOPE-C',
      patientId: patientOther._id,
      doctorId: doctorB._id,
      branchId: branchB._id,
    });

    await Consultation.create({
      consultationNumber: 'CON-SCOPE-A',
      appointmentId: apptA._id,
      patientId: patientA._id,
      doctorId: doctorA._id,
      branchId: branchA._id,
    });
    await Consultation.create({
      consultationNumber: 'CON-SCOPE-B',
      appointmentId: apptB._id,
      patientId: patientB._id,
      doctorId: doctorB._id,
      branchId: branchA._id,
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  describe('appointment list', () => {
    it('serves doctor A only their own appointments', async () => {
      const res = await request(app).get('/api/v1/appointments').set(auth(tokenDoctorA));

      expect(res.status).toBe(200);
      const numbers = res.body.data.map((a) => a.appointmentNumber);
      expect(numbers).toContain('APT-SCOPE-A');
      expect(numbers).not.toContain('APT-SCOPE-B');
      expect(numbers).not.toContain('APT-SCOPE-C');
    });

    it('serves doctor B only their own appointments (and not across branches)', async () => {
      const res = await request(app).get('/api/v1/appointments').set(auth(tokenDoctorB));

      expect(res.status).toBe(200);
      const numbers = res.body.data.map((a) => a.appointmentNumber);
      expect(numbers).toContain('APT-SCOPE-B');
      expect(numbers).not.toContain('APT-SCOPE-A');
      // APT-SCOPE-C is doctor B's own appointment but sits in branch B; branch scoping hides it.
      expect(numbers).not.toContain('APT-SCOPE-C');
    });

    it('OWNER still sees every doctor and every branch', async () => {
      const res = await request(app).get('/api/v1/appointments').set(auth(tokenOwner));

      expect(res.status).toBe(200);
      const numbers = res.body.data.map((a) => a.appointmentNumber);
      expect(numbers).toEqual(
        expect.arrayContaining(['APT-SCOPE-A', 'APT-SCOPE-B', 'APT-SCOPE-C'])
      );
    });
  });

  describe('consultation list', () => {
    it('serves doctor A only their own consultations', async () => {
      const res = await request(app).get('/api/v1/consultations/doctor').set(auth(tokenDoctorA));

      expect(res.status).toBe(200);
      const numbers = res.body.data.map((c) => c.consultationNumber);
      expect(numbers).toEqual(['CON-SCOPE-A']);
    });

    it('serves doctor B only their own consultations', async () => {
      const res = await request(app).get('/api/v1/consultations/doctor').set(auth(tokenDoctorB));

      expect(res.status).toBe(200);
      const numbers = res.body.data.map((c) => c.consultationNumber);
      expect(numbers).toEqual(['CON-SCOPE-B']);
    });
  });

  describe('client-supplied scope params cannot widen access', () => {
    it('rejects a doctorId belonging to another doctor on the appointment list', async () => {
      const res = await request(app)
        .get('/api/v1/appointments')
        .query({ doctorId: doctorB._id.toString() })
        .set(auth(tokenDoctorA));

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('DOCTOR_SCOPE_VIOLATION');
    });

    it('rejects another doctor\'s doctorId on the consultation list', async () => {
      const res = await request(app)
        .get('/api/v1/consultations/doctor')
        .query({ doctorId: doctorB._id.toString() })
        .set(auth(tokenDoctorA));

      expect(res.status).toBe(403);
    });

    it('rejects an out-of-scope branchId', async () => {
      const res = await request(app)
        .get('/api/v1/appointments')
        .query({ branchId: branchB._id.toString() })
        .set(auth(tokenDoctorA));

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('BRANCH_SCOPE_VIOLATION');
    });

    it('still honours a doctorId equal to the caller\'s own (narrowing is fine)', async () => {
      const res = await request(app)
        .get('/api/v1/appointments')
        .query({ doctorId: doctorA._id.toString() })
        .set(auth(tokenDoctorA));

      expect(res.status).toBe(200);
      expect(res.body.data.map((a) => a.appointmentNumber)).toEqual(['APT-SCOPE-A']);
    });

    it('lets OWNER filter to any branch they choose', async () => {
      const res = await request(app)
        .get('/api/v1/appointments')
        .query({ branchId: branchB._id.toString() })
        .set(auth(tokenOwner));

      expect(res.status).toBe(200);
      expect(res.body.data.map((a) => a.appointmentNumber)).toEqual(['APT-SCOPE-C']);
    });
  });

  describe('patient list', () => {
    it('scopes to the doctor\'s branch but not to their own patients only', async () => {
      const res = await request(app).get('/api/v1/patients').set(auth(tokenDoctorA));

      expect(res.status).toBe(200);
      const mrns = res.body.data.map((p) => p.mrn);
      // Both branch-A patients are visible: within a branch a doctor covers colleagues' patients,
      // so narrowing the patient BROWSE list to primaryDoctorId would be a safety regression.
      expect(mrns).toEqual(expect.arrayContaining(['MRN-SCOPE-A', 'MRN-SCOPE-B']));
      // The other branch's patient is not.
      expect(mrns).not.toContain('MRN-SCOPE-C');
    });

    it('OWNER sees patients across every branch', async () => {
      const res = await request(app).get('/api/v1/patients').set(auth(tokenOwner));

      expect(res.status).toBe(200);
      const mrns = res.body.data.map((p) => p.mrn);
      expect(mrns).toEqual(
        expect.arrayContaining(['MRN-SCOPE-A', 'MRN-SCOPE-B', 'MRN-SCOPE-C'])
      );
    });
  });

  describe('individual record reads stay broad (break-glass model)', () => {
    it('lets doctor A open another doctor\'s appointment by id', async () => {
      const res = await request(app)
        .get(`/api/v1/appointments/${apptB._id.toString()}`)
        .set(auth(tokenDoctorA));

      // Deliberately NOT 403: covering a colleague / emergencies. Audited, not blocked.
      expect(res.status).toBe(200);
      expect(res.body.data.appointment.appointmentNumber).toBe('APT-SCOPE-B');
    });
  });

  describe('fail-closed on an unassigned branch', () => {
    it('refuses a branch-scoped list for a user with no branch, with an actionable code', async () => {
      const stray = await makeStaffUser({
        email: 'scope.doctor.nobranch@test.local',
        role: ROLES.DOCTOR,
        branch: null,
      });
      await makeDoctor(stray, 'SC-N');
      const token = await mintToken(stray);

      const res = await request(app).get('/api/v1/appointments').set(auth(token));

      // Never "unscoped" (which would show the whole organisation) and never a silent empty
      // list that reads as "no data" — an explicit, fixable misconfiguration.
      expect(res.status).toBe(409);
      expect(res.body.error?.code || res.body.code).toBe('BRANCH_SCOPE_UNASSIGNED');
    });
  });

  describe('DOCTOR role grants', () => {
    it('no longer carries masters.view or resources.view', () => {
      expect(ROLE_PERMISSIONS[ROLES.DOCTOR]).not.toContain('masters.view');
      expect(ROLE_PERMISSIONS[ROLES.DOCTOR]).not.toContain('resources.view');
    });

    it('keeps the narrow masters.lookup grant that doctor pickers need', async () => {
      expect(ROLE_PERMISSIONS[ROLES.DOCTOR]).toContain('masters.lookup');

      const lookup = await request(app)
        .get('/api/v1/masters/services/active')
        .set(auth(tokenDoctorA));
      expect(lookup.status).toBe(200);

      // ...but the admin Masters browse read is now closed to them.
      const browse = await request(app).get('/api/v1/masters/services').set(auth(tokenDoctorA));
      expect(browse.status).toBe(403);
    });

    it('is denied the resources screen', async () => {
      const res = await request(app).get('/api/v1/resources/rooms').set(auth(tokenDoctorA));
      expect(res.status).toBe(403);
    });
  });

  it('keeps mongoose connected for the suite', () => {
    expect(mongoose.connection.readyState).toBe(1);
  });
});
