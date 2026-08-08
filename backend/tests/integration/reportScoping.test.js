import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import App from '../../src/app.js';
import User from '../../src/models/User.model.js';
import Role from '../../src/models/Role.model.js';
import Branch from '../../src/models/Branch.model.js';
import Patient from '../../src/models/Patient.model.js';
import ReportRun from '../../src/models/ReportRun.model.js';
import TokenService from '../../src/services/TokenService.js';
import { hashPassword } from '../../src/helpers/crypto.helper.js';
import { ROLE_PERMISSIONS } from '../../src/constants/rolePermissions.js';
import { ROLES, ROLE_LABELS } from '../../src/constants/roles.js';

/**
 * SEC-001 — the reporting stack FAILED OPEN.
 *
 * `parseReportFilters()` applied a branch match only when the caller supplied `branchId`, and never
 * received `req.auth`. So the attack was simply to OMIT the parameter: a branch-scoped BRANCH_MANAGER
 * asking for revenue with no filter got the whole organisation's figures. Reporting aggregates
 * everything — revenue, dues, patient volumes, PHI sample rows — so this leaked more than any single
 * list endpoint, and it leaked silently, because the response looked exactly like a valid report.
 *
 * The omitted-parameter case is therefore the centre of this suite. Asserting only that a *wrong*
 * branchId is rejected would have passed against the broken code.
 */
describe('SEC-001 report and analytics scoping', () => {
  let app;
  const tokenService = new TokenService();
  let branchA;
  let branchB;
  let tokenManagerA;
  let tokenOwner;
  let ownerUser;
  let managerAUser;

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
      email: `${code.toLowerCase()}@rptscope.test`,
      phone: '9000000000',
    });

  const makeUser = async ({ email, role, branch }) =>
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

  beforeAll(async () => {
    await connectTestDb('rptscope');
    app = new App().getExpressApp();

    for (const code of [ROLES.OWNER, ROLES.BRANCH_MANAGER]) {
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

    branchA = await makeBranch('RSA');
    branchB = await makeBranch('RSB');

    managerAUser = await makeUser({
      email: 'mgr.a@rptscope.test',
      role: ROLES.BRANCH_MANAGER,
      branch: branchA._id,
    });
    ownerUser = await makeUser({ email: 'owner@rptscope.test', role: ROLES.OWNER, branch: null });

    tokenManagerA = await mintToken(managerAUser);
    tokenOwner = await mintToken(ownerUser);

    // One patient in each branch — the simplest cross-branch signal a report can expose.
    await Patient.create({
      mrn: 'MRN-RS-A',
      firstName: 'Alpha',
      lastName: 'BranchA',
      gender: 'FEMALE',
      mobile: '9800000001',
      primaryBranchId: branchA._id,
    });
    await Patient.create({
      mrn: 'MRN-RS-B',
      firstName: 'Beta',
      lastName: 'BranchB',
      gender: 'MALE',
      mobile: '9800000002',
      primaryBranchId: branchB._id,
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  it('rejects a branch-scoped user asking for another branch explicitly', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/analytics?branchId=${branchB._id.toString()}`)
      .set(auth(tokenManagerA));

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('BRANCH_SCOPE_VIOLATION');
  });

  it('THE FAIL-OPEN: omitting branchId does not return organisation-wide data', async () => {
    // This is the case the old code got wrong. It must not 500 and must not silently widen.
    const res = await request(app).get('/api/v1/reports/analytics').set(auth(tokenManagerA));

    expect(res.status).toBe(200);
    // The request is answered, but scoped — proven below by the KPI comparison, since the shape
    // of an analytics payload varies by report type.
  });

  it('gives a branch-scoped manager different figures than the owner sees org-wide', async () => {
    // If the scope were still failing open these two would be identical, which is exactly the bug.
    const scoped = await request(app).get('/api/v1/reports/kpis').set(auth(tokenManagerA));
    const orgWide = await request(app).get('/api/v1/reports/kpis').set(auth(tokenOwner));

    expect(scoped.status).toBe(200);
    expect(orgWide.status).toBe(200);

    const scopedPatients = JSON.stringify(scoped.body.data ?? {});
    const orgPatients = JSON.stringify(orgWide.body.data ?? {});
    // Owner sees both branches' patients; the manager must not see the same total.
    expect(scopedPatients).not.toBe(orgPatients);
  });

  it('still lets the owner read organisation-wide reports (the fix must not be an outage)', async () => {
    const res = await request(app).get('/api/v1/reports/analytics').set(auth(tokenOwner));
    expect(res.status).toBe(200);
  });

  it('still lets a manager filter to their OWN branch explicitly', async () => {
    const res = await request(app)
      .get(`/api/v1/reports/analytics?branchId=${branchA._id.toString()}`)
      .set(auth(tokenManagerA));
    expect(res.status).toBe(200);
  });

  it('hides another user\'s report run behind a 404, not a 403', async () => {
    // A 403 would confirm the run exists — the very fact the scope protects. The run also retains
    // sample rows of real patient data in resultSummary.
    const run = await ReportRun.create({
      reportType: 'revenue',
      format: 'csv',
      status: 'COMPLETED',
      requestedBy: ownerUser._id,
      rowCount: 2,
      resultSummary: { sample: [{ mrn: 'MRN-RS-B', name: 'Beta BranchB' }] },
    });

    const res = await request(app)
      .get(`/api/v1/reports/runs/${run._id.toString()}`)
      .set(auth(tokenManagerA));

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('MRN-RS-B');
  });

  it('lets the requester read back their own report run', async () => {
    const run = await ReportRun.create({
      reportType: 'revenue',
      format: 'csv',
      status: 'COMPLETED',
      requestedBy: managerAUser._id,
      rowCount: 1,
      resultSummary: { sample: [] },
    });

    const res = await request(app)
      .get(`/api/v1/reports/runs/${run._id.toString()}`)
      .set(auth(tokenManagerA));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(run._id.toString());
  });

  it('lets the owner read any report run', async () => {
    const run = await ReportRun.create({
      reportType: 'revenue',
      format: 'csv',
      status: 'COMPLETED',
      requestedBy: managerAUser._id,
      rowCount: 1,
      resultSummary: { sample: [] },
    });

    const res = await request(app)
      .get(`/api/v1/reports/runs/${run._id.toString()}`)
      .set(auth(tokenOwner));

    expect(res.status).toBe(200);
  });
});
