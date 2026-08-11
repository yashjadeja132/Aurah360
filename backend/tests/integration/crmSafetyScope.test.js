import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import App from '../../src/app.js';
import User from '../../src/models/User.model.js';
import Role from '../../src/models/Role.model.js';
import Branch from '../../src/models/Branch.model.js';
import Doctor from '../../src/models/Doctor.model.js';
import Patient from '../../src/models/Patient.model.js';
import Lead from '../../src/models/Lead.model.js';
import LeadTask from '../../src/models/LeadTask.model.js';
import AdverseEvent from '../../src/models/AdverseEvent.model.js';
import RecallEntry from '../../src/models/RecallEntry.model.js';
import Offer from '../../src/models/Offer.model.js';
import Notification from '../../src/models/Notification.model.js';
import Master from '../../src/models/Master.model.js';
import TokenService from '../../src/services/TokenService.js';
import { hashPassword } from '../../src/helpers/crypto.helper.js';
import { ROLE_PERMISSIONS } from '../../src/constants/rolePermissions.js';
import { ROLES, ROLE_LABELS } from '../../src/constants/roles.js';

/**
 * SEC-030 (second wave) — row-level branch scoping for CRM, treatment-safety, staff, doctor and
 * branch endpoints, which previously passed `req.query` straight to their repositories.
 *
 * Every scoped endpoint is asserted in BOTH directions, because a scope that returns nothing is
 * an outage rather than a fix:
 *   1. the branch-scoped caller is REFUSED the other branch's row, and
 *   2. the same caller still receives their OWN branch's row, and
 *   3. OWNER still sees every branch.
 *
 * Out-of-scope SINGLE RECORDS must answer 404, never 403 — a 403 confirms the id exists, which
 * is precisely the fact the scope protects. That distinction is asserted explicitly.
 *
 * The suite also pins the three deliberate NON-scoping decisions (branch list, masters,
 * feedback) so a later "tidy-up" cannot quietly turn them into an outage.
 */
describe('SEC-030 CRM / safety / staff branch scoping', () => {
  let app;
  const tokenService = new TokenService();

  let branchA;
  let branchB;
  let tokenCrmA;      // CRM_EXECUTIVE pinned to branch A
  let tokenManagerA;  // BRANCH_MANAGER pinned to branch A
  let tokenOwner;
  let leadA;
  let leadB;
  let taskA;
  let taskB;
  let eventA;
  let eventB;
  let recallA;
  let recallB;
  let recallNoBranch;
  let offerA;
  let offerB;
  let offerGlobal;
  let staffA;
  let staffB;
  let doctorA;
  let doctorB;
  let patientA;
  let patientB;
  let ownerUser;

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
      email: `${code.toLowerCase()}@crmscope.test`,
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

  const makePatient = async (mrn, branchId) =>
    Patient.create({
      mrn,
      firstName: 'Pat',
      lastName: mrn,
      gender: 'FEMALE',
      mobile: `97${mrn.replace(/\D/g, '').padStart(8, '0')}`.slice(0, 10),
      primaryBranchId: branchId,
    });

  const makeLead = (number, branchId) =>
    Lead.create({
      leadNumber: number,
      firstName: 'Lead',
      lastName: number,
      phone: '9111111111',
      branchId,
    });

  const makeEvent = (description, branchId, patientId) =>
    AdverseEvent.create({
      patientId,
      branchId,
      severity: 'MILD',
      onsetAt: new Date(),
      description,
      responsibleClinicianId: ownerUser._id,
      reportedBy: ownerUser._id,
    });

  beforeAll(async () => {
    await connectTestDb('crmscope');
    app = new App().getExpressApp();

    for (const code of [ROLES.OWNER, ROLES.CRM_EXECUTIVE, ROLES.BRANCH_MANAGER, ROLES.RECEPTIONIST]) {
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

    branchA = await makeBranch('CRMSC-A');
    branchB = await makeBranch('CRMSC-B');

    const crmA = await makeStaffUser({
      email: 'crmscope.crm.a@test.local',
      role: ROLES.CRM_EXECUTIVE,
      branch: branchA._id,
    });
    const managerA = await makeStaffUser({
      email: 'crmscope.mgr.a@test.local',
      role: ROLES.BRANCH_MANAGER,
      branch: branchA._id,
    });
    // OWNER is intentionally branch-less — OWNER/ADMIN are the roles that span every branch.
    ownerUser = await makeStaffUser({ email: 'crmscope.owner@test.local', role: ROLES.OWNER });

    // Staff directory fixtures: one member of staff at each branch.
    staffA = await makeStaffUser({
      email: 'crmscope.staff.a@test.local',
      role: ROLES.RECEPTIONIST,
      branch: branchA._id,
    });
    staffB = await makeStaffUser({
      email: 'crmscope.staff.b@test.local',
      role: ROLES.RECEPTIONIST,
      branch: branchB._id,
    });

    tokenCrmA = await mintToken(crmA);
    tokenManagerA = await mintToken(managerA);
    tokenOwner = await mintToken(ownerUser);

    // Doctors hold branch PRIVILEGES (an array), not a single branch.
    const docUserA = await makeStaffUser({
      email: 'crmscope.doc.a@test.local',
      role: ROLES.DOCTOR,
      branch: branchA._id,
    });
    const docUserB = await makeStaffUser({
      email: 'crmscope.doc.b@test.local',
      role: ROLES.DOCTOR,
      branch: branchB._id,
    });
    doctorA = await Doctor.create({
      userId: docUserA._id,
      doctorCode: 'CRMSC-DA',
      licenseNumber: 'LIC-CRMSC-DA',
      registrationNumber: 'REG-CRMSC-DA',
      branches: [branchA._id],
    });
    doctorB = await Doctor.create({
      userId: docUserB._id,
      doctorCode: 'CRMSC-DB',
      licenseNumber: 'LIC-CRMSC-DB',
      registrationNumber: 'REG-CRMSC-DB',
      branches: [branchB._id],
    });

    patientA = await makePatient('MRN-CRMSC-A', branchA._id);
    patientB = await makePatient('MRN-CRMSC-B', branchB._id);

    leadA = await makeLead('LEAD-CRMSC-A', branchA._id);
    leadB = await makeLead('LEAD-CRMSC-B', branchB._id);

    taskA = await LeadTask.create({ leadId: leadA._id, title: 'TASK-CRMSC-A' });
    taskB = await LeadTask.create({ leadId: leadB._id, title: 'TASK-CRMSC-B' });

    eventA = await makeEvent('AE-CRMSC-A', branchA._id, patientA._id);
    eventB = await makeEvent('AE-CRMSC-B', branchB._id, patientB._id);

    const due = new Date(Date.now() - 86400000);
    recallA = await RecallEntry.create({ patientId: patientA._id, branchId: branchA._id, dueDate: due, purpose: 'RC-CRMSC-A' });
    recallB = await RecallEntry.create({ patientId: patientB._id, branchId: branchB._id, dueDate: due, purpose: 'RC-CRMSC-B' });
    // branchId is nullable — an unassigned recall belongs to nobody, so it must stay visible.
    recallNoBranch = await RecallEntry.create({ patientId: patientA._id, branchId: null, dueDate: due, purpose: 'RC-CRMSC-NONE' });

    const validFrom = new Date(Date.now() - 86400000);
    const validTo = new Date(Date.now() + 86400000);
    offerA = await Offer.create({ title: { en: 'OFFER-CRMSC-A' }, validFrom, validTo, branchIds: [branchA._id] });
    offerB = await Offer.create({ title: { en: 'OFFER-CRMSC-B' }, validFrom, validTo, branchIds: [branchB._id] });
    // Empty branchIds means "all branches" — every branch must keep seeing it.
    offerGlobal = await Offer.create({ title: { en: 'OFFER-CRMSC-ALL' }, validFrom, validTo, branchIds: [] });

    await Master.create({ type: 'SERVICE', name: 'CRMSC Service' });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  // ————————————————————————— adverse events (the sharp one) —————————————————————————
  describe('adverse event list', () => {
    it('serves a branch-scoped caller only their own branch\'s adverse events', async () => {
      const res = await request(app)
        .get('/api/v1/treatment-safety/adverse-events')
        .set(auth(tokenManagerA));

      expect(res.status).toBe(200);
      const descriptions = res.body.data.events.map((e) => e.description);
      expect(descriptions).toContain('AE-CRMSC-A');
      expect(descriptions).not.toContain('AE-CRMSC-B');
    });

    it('OWNER still sees adverse events from every branch', async () => {
      const res = await request(app)
        .get('/api/v1/treatment-safety/adverse-events')
        .set(auth(tokenOwner));

      expect(res.status).toBe(200);
      const descriptions = res.body.data.events.map((e) => e.description);
      expect(descriptions).toEqual(expect.arrayContaining(['AE-CRMSC-A', 'AE-CRMSC-B']));
    });

    it('rejects an out-of-scope branchId rather than honouring it', async () => {
      const res = await request(app)
        .get('/api/v1/treatment-safety/adverse-events')
        .query({ branchId: branchB._id.toString() })
        .set(auth(tokenManagerA));

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('BRANCH_SCOPE_VIOLATION');
    });

    it('answers 404 (not 403) when closing another branch\'s adverse event', async () => {
      const res = await request(app)
        .post(`/api/v1/treatment-safety/adverse-events/${eventB._id.toString()}/close`)
        .send({ closureNotes: 'nope' })
        .set(auth(tokenManagerA));

      // 403 would confirm the event exists; 404 does not.
      expect(res.status).toBe(404);
    });

    it('still lets the same caller close their OWN branch\'s adverse event', async () => {
      const res = await request(app)
        .post(`/api/v1/treatment-safety/adverse-events/${eventA._id.toString()}/close`)
        .send({ closureNotes: 'handled' })
        .set(auth(tokenManagerA));

      expect(res.status).toBe(200);
      expect(res.body.data.event.status).toBe('CLOSED');
    });

    it('answers 404 when updating another branch\'s adverse event', async () => {
      const res = await request(app)
        .patch(`/api/v1/treatment-safety/adverse-events/${eventB._id.toString()}`)
        .send({ status: 'UNDER_REVIEW' })
        .set(auth(tokenManagerA));

      expect(res.status).toBe(404);
    });
  });

  // ————————————————————————— CRM leads —————————————————————————
  describe('lead list', () => {
    it('serves a branch-scoped caller only their own branch\'s leads', async () => {
      const res = await request(app).get('/api/v1/crm/leads').set(auth(tokenCrmA));

      expect(res.status).toBe(200);
      const numbers = res.body.data.map((l) => l.leadNumber);
      expect(numbers).toContain('LEAD-CRMSC-A');
      expect(numbers).not.toContain('LEAD-CRMSC-B');
    });

    it('OWNER still sees leads from every branch', async () => {
      const res = await request(app).get('/api/v1/crm/leads').set(auth(tokenOwner));

      expect(res.status).toBe(200);
      const numbers = res.body.data.map((l) => l.leadNumber);
      expect(numbers).toEqual(expect.arrayContaining(['LEAD-CRMSC-A', 'LEAD-CRMSC-B']));
    });

    it('rejects an out-of-scope branchId on the lead list', async () => {
      const res = await request(app)
        .get('/api/v1/crm/leads')
        .query({ branchId: branchB._id.toString() })
        .set(auth(tokenCrmA));

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('BRANCH_SCOPE_VIOLATION');
    });

    it('answers 404 (not 403) on another branch\'s lead by id', async () => {
      const res = await request(app)
        .get(`/api/v1/crm/leads/${leadB._id.toString()}`)
        .set(auth(tokenCrmA));

      expect(res.status).toBe(404);
    });

    it('still serves the caller\'s own lead by id', async () => {
      const res = await request(app)
        .get(`/api/v1/crm/leads/${leadA._id.toString()}`)
        .set(auth(tokenCrmA));

      expect(res.status).toBe(200);
      expect(res.body.data.lead.leadNumber).toBe('LEAD-CRMSC-A');
    });

    it('answers 404 when editing another branch\'s lead', async () => {
      const res = await request(app)
        .patch(`/api/v1/crm/leads/${leadB._id.toString()}`)
        .send({ city: 'Hijacked' })
        .set(auth(tokenCrmA));

      expect(res.status).toBe(404);
    });

    it('still lets the caller edit their own branch\'s lead', async () => {
      const res = await request(app)
        .patch(`/api/v1/crm/leads/${leadA._id.toString()}`)
        .send({ city: 'Ahmedabad' })
        .set(auth(tokenCrmA));

      expect(res.status).toBe(200);
      expect(res.body.data.lead.city).toBe('Ahmedabad');
    });

    it('refuses to create a lead in another branch', async () => {
      const res = await request(app)
        .post('/api/v1/crm/leads')
        .send({ firstName: 'Sneaky', phone: '9222222222', branchId: branchB._id.toString() })
        .set(auth(tokenCrmA));

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('BRANCH_SCOPE_VIOLATION');
    });

    it('scopes the CRM dashboard and pipeline to the caller\'s branch', async () => {
      const pipeline = await request(app).get('/api/v1/crm/pipeline').set(auth(tokenCrmA));
      expect(pipeline.status).toBe(200);
      const piped = Object.values(pipeline.body.data.columns)
        .flat()
        .map((l) => l.leadNumber);
      expect(piped).toContain('LEAD-CRMSC-A');
      expect(piped).not.toContain('LEAD-CRMSC-B');

      const dashboard = await request(app).get('/api/v1/crm/dashboard').set(auth(tokenCrmA));
      expect(dashboard.status).toBe(200);
      expect(dashboard.body.data.summary.total).toBe(1);
    });

    it('scopes CRM reports — a branch cannot read the whole org\'s conversion numbers', async () => {
      const scoped = await request(app)
        .get('/api/v1/crm/reports/conversion')
        .set(auth(tokenCrmA));
      expect(scoped.status).toBe(200);
      expect(scoped.body.data.total).toBe(1);

      const owner = await request(app)
        .get('/api/v1/crm/reports/conversion')
        .set(auth(tokenOwner));
      expect(owner.status).toBe(200);
      expect(owner.body.data.total).toBe(2);
    });
  });

  describe('lead task list (branch inherited from the lead)', () => {
    it('serves a branch-scoped caller only tasks belonging to their branch\'s leads', async () => {
      const res = await request(app).get('/api/v1/crm/tasks').set(auth(tokenCrmA));

      expect(res.status).toBe(200);
      const titles = res.body.data.map((t) => t.title);
      expect(titles).toContain('TASK-CRMSC-A');
      expect(titles).not.toContain('TASK-CRMSC-B');
    });

    it('OWNER still sees every branch\'s tasks', async () => {
      const res = await request(app).get('/api/v1/crm/tasks').set(auth(tokenOwner));

      expect(res.status).toBe(200);
      const titles = res.body.data.map((t) => t.title);
      expect(titles).toEqual(expect.arrayContaining(['TASK-CRMSC-A', 'TASK-CRMSC-B']));
    });

    it('does not honour a leadId pointing at another branch\'s lead', async () => {
      const res = await request(app)
        .get('/api/v1/crm/tasks')
        .query({ leadId: leadB._id.toString() })
        .set(auth(tokenCrmA));

      expect(res.status).toBe(200);
      expect(res.body.data.map((t) => t.title)).not.toContain('TASK-CRMSC-B');
    });

    it('answers 404 when updating a task on another branch\'s lead', async () => {
      const res = await request(app)
        .patch(`/api/v1/crm/tasks/${taskB._id.toString()}`)
        .send({ title: 'Hijacked' })
        .set(auth(tokenCrmA));

      expect(res.status).toBe(404);
    });

    it('still lets the caller update their own branch\'s task', async () => {
      const res = await request(app)
        .patch(`/api/v1/crm/tasks/${taskA._id.toString()}`)
        .send({ title: 'TASK-CRMSC-A2' })
        .set(auth(tokenCrmA));

      expect(res.status).toBe(200);
      expect(res.body.data.task.title).toBe('TASK-CRMSC-A2');
    });
  });

  // ————————————————————————— CRM extensions —————————————————————————
  describe('recall worklist', () => {
    it('serves the caller their own branch\'s recalls plus unassigned ones, never another branch\'s', async () => {
      const res = await request(app).get('/api/v1/crm-extensions/recall').set(auth(tokenCrmA));

      expect(res.status).toBe(200);
      const purposes = res.body.data.entries.map((e) => e.purpose);
      expect(purposes).toContain('RC-CRMSC-A');
      // branchId: null is "not tied to a site" — hiding it would be an outage, not a fix.
      expect(purposes).toContain('RC-CRMSC-NONE');
      expect(purposes).not.toContain('RC-CRMSC-B');
    });

    it('OWNER sees every branch\'s recalls', async () => {
      const res = await request(app).get('/api/v1/crm-extensions/recall').set(auth(tokenOwner));

      expect(res.status).toBe(200);
      const purposes = res.body.data.entries.map((e) => e.purpose);
      expect(purposes).toEqual(expect.arrayContaining(['RC-CRMSC-A', 'RC-CRMSC-B', 'RC-CRMSC-NONE']));
    });

    it('answers 404 when recording an outcome on another branch\'s recall', async () => {
      const res = await request(app)
        .post(`/api/v1/crm-extensions/recall/${recallB._id.toString()}/outcome`)
        .send({ status: 'BOOKED' })
        .set(auth(tokenCrmA));

      expect(res.status).toBe(404);
    });

    it('still lets the caller record an outcome on their own recall', async () => {
      const res = await request(app)
        .post(`/api/v1/crm-extensions/recall/${recallA._id.toString()}/outcome`)
        .send({ status: 'BOOKED' })
        .set(auth(tokenCrmA));

      expect(res.status).toBe(200);
      expect(res.body.data.entry.status).toBe('BOOKED');
    });
  });

  describe('offer board', () => {
    it('serves the caller their branch\'s offers plus org-wide ones, never another branch\'s', async () => {
      const res = await request(app).get('/api/v1/crm-extensions/offers').set(auth(tokenCrmA));

      expect(res.status).toBe(200);
      const titles = res.body.data.offers.map((o) => o.title.en);
      expect(titles).toContain('OFFER-CRMSC-A');
      // branchIds: [] means every branch — it must not disappear behind the scope.
      expect(titles).toContain('OFFER-CRMSC-ALL');
      expect(titles).not.toContain('OFFER-CRMSC-B');
    });

    it('OWNER sees every offer', async () => {
      const res = await request(app).get('/api/v1/crm-extensions/offers').set(auth(tokenOwner));

      expect(res.status).toBe(200);
      const titles = res.body.data.offers.map((o) => o.title.en);
      expect(titles).toEqual(
        expect.arrayContaining(['OFFER-CRMSC-A', 'OFFER-CRMSC-B', 'OFFER-CRMSC-ALL'])
      );
    });

    it('answers 404 when editing another branch\'s offer', async () => {
      const res = await request(app)
        .patch(`/api/v1/crm-extensions/offers/${offerB._id.toString()}`)
        .send({ isActive: false })
        .set(auth(tokenManagerA));

      expect(res.status).toBe(404);
    });

    it('answers 404 when editing the org-wide offer from a single branch', async () => {
      // Editing branchIds:[] from one site would change what every other site shows.
      const res = await request(app)
        .patch(`/api/v1/crm-extensions/offers/${offerGlobal._id.toString()}`)
        .send({ isActive: false })
        .set(auth(tokenManagerA));

      expect(res.status).toBe(404);
    });

    it('still lets the caller edit their own branch\'s offer', async () => {
      const res = await request(app)
        .patch(`/api/v1/crm-extensions/offers/${offerA._id.toString()}`)
        .send({ bookingCta: 'Reserve' })
        .set(auth(tokenManagerA));

      expect(res.status).toBe(200);
      expect(res.body.data.offer.bookingCta).toBe('Reserve');
    });
  });

  // ————————————————————————— staff directory —————————————————————————
  describe('staff directory', () => {
    it('serves a BRANCH_MANAGER only their own branch\'s staff', async () => {
      const res = await request(app).get('/api/v1/users').set(auth(tokenManagerA));

      expect(res.status).toBe(200);
      const emails = res.body.data.map((u) => u.email);
      expect(emails).toContain('crmscope.staff.a@test.local');
      expect(emails).not.toContain('crmscope.staff.b@test.local');
    });

    it('OWNER still sees staff at every branch', async () => {
      const res = await request(app).get('/api/v1/users').set(auth(tokenOwner));

      expect(res.status).toBe(200);
      const emails = res.body.data.map((u) => u.email);
      expect(emails).toEqual(
        expect.arrayContaining(['crmscope.staff.a@test.local', 'crmscope.staff.b@test.local'])
      );
    });

    it('answers 404 (not 403) on another branch\'s staff record by id', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${staffB._id.toString()}`)
        .set(auth(tokenManagerA));

      expect(res.status).toBe(404);
    });

    it('still serves the caller their own branch\'s staff record', async () => {
      const res = await request(app)
        .get(`/api/v1/users/${staffA._id.toString()}`)
        .set(auth(tokenManagerA));

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('crmscope.staff.a@test.local');
    });

    it('refuses to deactivate another branch\'s staff member', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${staffB._id.toString()}/deactivate`)
        .set(auth(tokenManagerA));

      expect(res.status).toBe(404);
      // and the account really is untouched
      expect((await User.findById(staffB._id)).isActive).toBe(true);
    });

    it('still lets the manager deactivate their own branch\'s staff member', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${staffA._id.toString()}/deactivate`)
        .set(auth(tokenManagerA));

      expect(res.status).toBe(200);
      await request(app)
        .post(`/api/v1/users/${staffA._id.toString()}/activate`)
        .set(auth(tokenManagerA));
    });

    it('refuses to create a staff member in another branch', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .send({
          firstName: 'Sneaky',
          lastName: 'Hire',
          email: 'crmscope.sneaky@test.local',
          password: 'Password@12345',
          role: ROLES.RECEPTIONIST,
          branch: branchB._id.toString(),
        })
        .set(auth(tokenManagerA));

      expect(res.status).toBe(403);
      expect(res.body.error?.code || res.body.code).toBe('BRANCH_SCOPE_VIOLATION');
    });
  });

  // ————————————————————————— doctors (privileges, not one branch) —————————————————————————
  describe('doctor list', () => {
    it('serves a branch-scoped caller only doctors with privileges at their branch', async () => {
      const res = await request(app).get('/api/v1/doctors').set(auth(tokenManagerA));

      expect(res.status).toBe(200);
      const codes = res.body.data.map((d) => d.doctorCode);
      expect(codes).toContain('CRMSC-DA');
      expect(codes).not.toContain('CRMSC-DB');
    });

    it('OWNER still sees doctors at every branch', async () => {
      const res = await request(app).get('/api/v1/doctors').set(auth(tokenOwner));

      expect(res.status).toBe(200);
      const codes = res.body.data.map((d) => d.doctorCode);
      expect(codes).toEqual(expect.arrayContaining(['CRMSC-DA', 'CRMSC-DB']));
    });

    it('keeps a doctor visible from EVERY branch they hold privileges at', async () => {
      // Set membership, not equality: a multi-site consultant must appear in both lists.
      await Doctor.findByIdAndUpdate(doctorB._id, { branches: [branchA._id, branchB._id] });

      const res = await request(app).get('/api/v1/doctors').set(auth(tokenManagerA));
      expect(res.status).toBe(200);
      expect(res.body.data.map((d) => d.doctorCode)).toEqual(
        expect.arrayContaining(['CRMSC-DA', 'CRMSC-DB'])
      );

      await Doctor.findByIdAndUpdate(doctorB._id, { branches: [branchB._id] });
    });

    it('answers 404 when deactivating a doctor who does not practise at the caller\'s branch', async () => {
      const res = await request(app)
        .post(`/api/v1/doctors/${doctorB._id.toString()}/deactivate`)
        .set(auth(tokenManagerA));

      expect(res.status).toBe(404);
    });

    it('still lets the manager deactivate a doctor at their own branch', async () => {
      const res = await request(app)
        .post(`/api/v1/doctors/${doctorA._id.toString()}/deactivate`)
        .set(auth(tokenManagerA));

      expect(res.status).toBe(200);
      await request(app)
        .post(`/api/v1/doctors/${doctorA._id.toString()}/activate`)
        .set(auth(tokenManagerA));
    });

    it('leaves an individual doctor profile readable across branches (professional reference data)', async () => {
      const res = await request(app)
        .get(`/api/v1/doctors/${doctorB._id.toString()}`)
        .set(auth(tokenManagerA));

      // Deliberately NOT 404: doctor ids are referenced from cross-branch appointments,
      // referrals and prescriptions that the caller can already read.
      expect(res.status).toBe(200);
    });
  });

  // ————————————————————————— branches: reads open, writes scoped —————————————————————————
  describe('branch list stays org-wide (deliberate)', () => {
    it('serves a branch-scoped user EVERY branch, so their screens can resolve context', async () => {
      const res = await request(app).get('/api/v1/branches').set(auth(tokenManagerA));

      expect(res.status).toBe(200);
      const codes = res.body.data.map((b) => b.branchCode);
      // Narrowing this to one row would re-break the doctor/receptionist/nurse screens that
      // were granted branches.view precisely so they could resolve their own branch.
      expect(codes).toEqual(expect.arrayContaining(['CRMSC-A', 'CRMSC-B']));
    });

    it('refuses to let a branch manager rename ANOTHER branch', async () => {
      const res = await request(app)
        .patch(`/api/v1/branches/${branchB._id.toString()}`)
        .send({ displayName: 'Hijacked' })
        .set(auth(tokenManagerA));

      expect(res.status).toBe(404);
      expect((await Branch.findById(branchB._id)).displayName).toBe('Branch CRMSC-B');
    });

    it('refuses to let a branch manager deactivate ANOTHER branch', async () => {
      const res = await request(app)
        .post(`/api/v1/branches/${branchB._id.toString()}/deactivate`)
        .send({ reason: 'Testing cross-branch scope' })
        .set(auth(tokenManagerA));

      expect(res.status).toBe(404);
      expect((await Branch.findById(branchB._id)).isActive).toBe(true);
    });

    it('still lets a branch manager edit their OWN branch', async () => {
      const res = await request(app)
        .patch(`/api/v1/branches/${branchA._id.toString()}`)
        .send({ displayName: 'Branch CRMSC-A Renamed' })
        .set(auth(tokenManagerA));

      expect(res.status).toBe(200);
      expect(res.body.data.branch.displayName).toBe('Branch CRMSC-A Renamed');
    });
  });

  // ————————————————————————— deliberate non-scoping —————————————————————————
  describe('org-wide reference data stays org-wide', () => {
    it('serves masters to a branch-scoped caller (no branch dimension on the model)', async () => {
      const res = await request(app).get('/api/v1/masters/services').set(auth(tokenManagerA));

      expect(res.status).toBe(200);
      expect(res.body.data.map((m) => m.name)).toContain('CRMSC Service');
    });
  });

  describe('notifications have no branch dimension, but are not a free-for-all', () => {
    it('hides a notification addressed to another member of staff behind a 404', async () => {
      const other = await Notification.create({
        notificationId: 'NTF-CRMSC-OTHER',
        eventName: 'TestEvent',
        userId: staffB._id,
        recipient: 'staff.b@test.local',
        channel: 'IN_APP',
        message: 'private staff message',
      });

      const res = await request(app)
        .get(`/api/v1/notifications/${other._id.toString()}`)
        .set(auth(tokenManagerA));

      expect(res.status).toBe(404);

      // OWNER still reads it — the fix must not become an outage for the org's owner.
      const asOwner = await request(app)
        .get(`/api/v1/notifications/${other._id.toString()}`)
        .set(auth(tokenOwner));
      expect(asOwner.status).toBe(200);
    });

    it('still serves an unaddressed (patient/broadcast) notification to the delivery log', async () => {
      const broadcast = await Notification.create({
        notificationId: 'NTF-CRMSC-BCAST',
        eventName: 'TestEvent',
        userId: null,
        patientId: patientA._id,
        recipient: '9999999999',
        channel: 'SMS',
        message: 'appointment reminder',
      });

      const res = await request(app)
        .get(`/api/v1/notifications/${broadcast._id.toString()}`)
        .set(auth(tokenManagerA));

      expect(res.status).toBe(200);
      expect(res.body.data.notification.notificationId).toBe('NTF-CRMSC-BCAST');
    });
  });
});
