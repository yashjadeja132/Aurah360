import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import App from '../../src/app.js';
import User from '../../src/models/User.model.js';
import AuditLog from '../../src/models/AuditLog.model.js';
import TokenService from '../../src/services/TokenService.js';
import { hashPassword } from '../../src/helpers/crypto.helper.js';
import { ROLE_PERMISSIONS } from '../../src/constants/rolePermissions.js';
import { ROLES } from '../../src/constants/roles.js';
import { PERMISSIONS } from '../../src/constants/permissions.js';
import { AUDIT_ACTIONS } from '../../src/enums/auditAction.js';

/**
 * NFR-018 — the audit trail's read side, which did not exist: `AuditLogRepository` was never
 * referenced by any controller or route, so ~196 recorded action types could not be produced for
 * an auditor or an incident.
 *
 * Every case is asserted in both directions. A search endpoint that returns nothing to everyone
 * would satisfy "no unauthorised access" and still fail the requirement, so each refusal is paired
 * with the authorised call that must keep working, and each redaction with an assertion that the
 * fields an auditor actually needs (ids, actions, correlation ids, timestamps) survived it.
 */
describe('NFR-018 audit log search', () => {
  let app;
  const tokenService = new TokenService();

  let branchA;
  let branchB;
  let tokenOwner;
  let tokenAdmin;
  let tokenDoctor;
  let tokenBranchAuditor;
  let userOwner;
  let userActor;
  const patientId = new mongoose.Types.ObjectId().toString();
  const otherPatientId = new mongoose.Types.ObjectId().toString();
  const correlationId = 'a360t-corr-nfr018';

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  const mintToken = (user, permissions) =>
    tokenService.signAccessToken({
      sub: user._id.toString(),
      role: user.role,
      permissions:
        permissions || (user.role === ROLES.OWNER ? ['*'] : ROLE_PERMISSIONS[user.role] || []),
      branch: user.branch ? user.branch.toString() : null,
    });

  const makeUser = async ({ email, role, branch }) =>
    User.create({
      firstName: role,
      lastName: email.split('@')[0],
      email,
      passwordHash: await hashPassword('Password@12345'),
      employeeId: `AS-${email.split('@')[0].toUpperCase()}`,
      role,
      branch: branch || null,
      isActive: true,
      status: 'ACTIVE',
    });

  beforeAll(async () => {
    await connectTestDb('auditsrch');
    app = new App().getExpressApp();

    // Bare ObjectIds: nothing under test dereferences a Branch row (scoping compares ids), and
    // this cluster sits on a hard collection ceiling.
    branchA = new mongoose.Types.ObjectId();
    branchB = new mongoose.Types.ObjectId();

    userOwner = await makeUser({ email: 'owner@auditsrch.test', role: ROLES.OWNER, branch: branchA });
    const admin = await makeUser({ email: 'admin@auditsrch.test', role: ROLES.ADMIN, branch: branchA });
    const doctor = await makeUser({ email: 'doc@auditsrch.test', role: ROLES.DOCTOR, branch: branchA });
    userActor = await makeUser({ email: 'actor@auditsrch.test', role: ROLES.NURSE, branch: branchA });
    const branchAuditor = await makeUser({
      email: 'bmauditor@auditsrch.test',
      role: ROLES.BRANCH_MANAGER,
      branch: branchB,
    });

    tokenOwner = mintToken(userOwner);
    tokenAdmin = mintToken(admin);
    tokenDoctor = mintToken(doctor);
    /**
     * A branch-pinned role that has been GRANTED audit.view. No seeded role is in this position
     * today (only OWNER/ADMIN hold it, both global-scope), but roles are database-backed and
     * editable — this is the case the branch pin exists for, and the only way to prove the pin is
     * real rather than incidentally unreachable.
     */
    tokenBranchAuditor = mintToken(branchAuditor, [PERMISSIONS.AUDIT_VIEW]);

    await AuditLog.create([
      {
        action: AUDIT_ACTIONS.PATIENT_DOCUMENT_RENAMED,
        actorId: userActor._id,
        branchId: branchA,
        correlationId,
        resourceType: 'PatientDocument',
        resourceId: 'doc-1',
        createdAt: new Date('2026-03-01T10:00:00Z'),
        metadata: {
          patientId,
          previousTitle: 'Biopsy result: melanoma suspected',
          newTitle: 'Biopsy result (corrected)',
          reviewState: 'REVIEWED',
          version: 2,
          nested: { note: 'spoke to the patient about the result', linkedId: patientId },
        },
      },
      {
        action: AUDIT_ACTIONS.PATIENT_DOCUMENT_DOWNLOADED,
        actorId: userActor._id,
        branchId: branchA,
        correlationId,
        createdAt: new Date('2026-03-02T10:00:00Z'),
        metadata: { patientId, mode: 'DOWNLOAD' },
      },
      {
        action: AUDIT_ACTIONS.LOGIN,
        actorId: userActor._id,
        branchId: branchB,
        createdAt: new Date('2026-03-03T10:00:00Z'),
        metadata: { patientId: otherPatientId },
      },
      {
        // Identifies its patient through resourceType/resourceId rather than metadata — the
        // second shape the patient filter has to understand.
        action: AUDIT_ACTIONS.PATIENT_UPDATED,
        actorId: userActor._id,
        branchId: branchA,
        resourceType: 'Patient',
        resourceId: patientId,
        createdAt: new Date('2026-03-04T10:00:00Z'),
        metadata: {},
      },
    ]);
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  // --- authorised access ---------------------------------------------------

  it('lets an AUDIT_VIEW holder search the trail, newest first', async () => {
    const res = await request(app)
      .get(`/api/v1/audit/entries?correlationId=${correlationId}`)
      .set(auth(tokenOwner));

    expect(res.status).toBe(200);
    const entries = res.body.data.entries;
    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe(AUDIT_ACTIONS.PATIENT_DOCUMENT_DOWNLOADED);
    expect(entries[1].action).toBe(AUDIT_ACTIONS.PATIENT_DOCUMENT_RENAMED);
    expect(res.body.meta.total).toBe(2);
  });

  it('filters by actor, action and date range', async () => {
    const byActor = await request(app)
      .get(`/api/v1/audit/entries?actorId=${userActor._id}&action=${AUDIT_ACTIONS.LOGIN}`)
      .set(auth(tokenOwner));
    expect(byActor.status).toBe(200);
    expect(byActor.body.data.entries).toHaveLength(1);

    const byDate = await request(app)
      .get('/api/v1/audit/entries?from=2026-03-03T00:00:00Z&to=2026-03-03T23:59:59Z')
      .set(auth(tokenOwner));
    expect(byDate.status).toBe(200);
    expect(byDate.body.data.entries.map((e) => e.action)).toEqual([AUDIT_ACTIONS.LOGIN]);
  });

  it('finds a patient\'s rows whether the patient is in metadata or in resourceId', async () => {
    const res = await request(app)
      .get(`/api/v1/audit/entries?patientId=${patientId}`)
      .set(auth(tokenOwner));

    expect(res.status).toBe(200);
    const actions = res.body.data.entries.map((e) => e.action);
    expect(actions).toContain(AUDIT_ACTIONS.PATIENT_DOCUMENT_RENAMED); // metadata.patientId
    expect(actions).toContain(AUDIT_ACTIONS.PATIENT_UPDATED); // resourceType/resourceId
    expect(actions).not.toContain(AUDIT_ACTIONS.LOGIN); // a different patient
  });

  it('paginates', async () => {
    const res = await request(app)
      .get(`/api/v1/audit/entries?patientId=${patientId}&limit=1&page=2`)
      .set(auth(tokenOwner));
    expect(res.status).toBe(200);
    expect(res.body.data.entries).toHaveLength(1);
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.total).toBe(3);
  });

  // --- refusals ------------------------------------------------------------

  it('refuses a role without AUDIT_VIEW', async () => {
    const res = await request(app).get('/api/v1/audit/entries').set(auth(tokenDoctor));
    expect(res.status).toBe(403);
  });

  it('refuses an unauthenticated caller', async () => {
    const res = await request(app).get('/api/v1/audit/entries');
    expect(res.status).toBe(401);
  });

  // --- branch scope --------------------------------------------------------

  it('pins a branch-scoped AUDIT_VIEW holder to their own branch\'s rows', async () => {
    const res = await request(app).get('/api/v1/audit/entries').set(auth(tokenBranchAuditor));
    expect(res.status).toBe(200);

    const branches = res.body.data.entries.map((e) => e.branchId);
    expect(branches.length).toBeGreaterThan(0);
    expect(branches.every((b) => b === branchB.toString())).toBe(true);
    expect(res.body.data.entries.map((e) => e.action)).not.toContain(
      AUDIT_ACTIONS.PATIENT_DOCUMENT_RENAMED
    );
  });

  it('refuses a branch-scoped caller who aims the filter at another branch', async () => {
    const res = await request(app)
      .get(`/api/v1/audit/entries?branchId=${branchA}`)
      .set(auth(tokenBranchAuditor));
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.error?.code).toBe('BRANCH_SCOPE_VIOLATION');
  });

  it('leaves a global-scope caller able to narrow to any branch', async () => {
    const res = await request(app)
      .get(`/api/v1/audit/entries?branchId=${branchA}`)
      .set(auth(tokenOwner));
    expect(res.status).toBe(200);
    expect(res.body.data.entries.every((e) => e.branchId === branchA.toString())).toBe(true);
  });

  // --- metadata / PHI ------------------------------------------------------

  it('redacts free-text metadata by default while keeping ids and enum values', async () => {
    const res = await request(app)
      .get(`/api/v1/audit/entries?action=${AUDIT_ACTIONS.PATIENT_DOCUMENT_RENAMED}`)
      .set(auth(tokenAdmin));

    expect(res.status).toBe(200);
    const entry = res.body.data.entries[0];
    expect(entry.metadataRedacted).toBe(true);
    expect(res.body.meta.metadataRedacted).toBe(true);

    // Free text — the shape PHI arrives in.
    expect(entry.metadata.previousTitle).toBe('[redacted]');
    expect(entry.metadata.newTitle).toBe('[redacted]');
    expect(entry.metadata.nested.note).toBe('[redacted]');
    // Structurally safe values an auditor needs to correlate rows.
    expect(entry.metadata.patientId).toBe(patientId);
    expect(entry.metadata.nested.linkedId).toBe(patientId);
    expect(entry.metadata.reviewState).toBe('REVIEWED');
    expect(entry.metadata.version).toBe(2);
    // Redaction must not cost the columns the search exists to expose.
    expect(entry.actorId).toBe(userActor._id.toString());
    expect(entry.correlationId).toBe(correlationId);
    expect(entry.createdAt).toBeTruthy();
  });

  it('refuses an AUDIT_VIEW-only caller who asks for unredacted metadata', async () => {
    const res = await request(app)
      .get('/api/v1/audit/entries?includeMetadata=true')
      .set(auth(tokenAdmin));
    expect(res.status).toBe(403);
    expect(res.body.code || res.body.error?.code).toBe('AUDIT_METADATA_NOT_PERMITTED');
  });

  it('returns unredacted metadata to an AUDIT_METADATA_VIEW holder, and audits the reveal', async () => {
    const res = await request(app)
      .get(`/api/v1/audit/entries?action=${AUDIT_ACTIONS.PATIENT_DOCUMENT_RENAMED}&includeMetadata=true`)
      .set(auth(tokenOwner));

    expect(res.status).toBe(200);
    const entry = res.body.data.entries[0];
    expect(entry.metadataRedacted).toBe(false);
    expect(entry.metadata.previousTitle).toBe('Biopsy result: melanoma suspected');

    const reveal = await AuditLog.findOne({
      action: AUDIT_ACTIONS.AUDIT_LOG_METADATA_REVEALED,
      actorId: userOwner._id,
    });
    expect(reveal).toBeTruthy();
  });

  // --- the read is itself audited -----------------------------------------

  it('records the search itself, with the filter that produced it', async () => {
    const marker = 'a360t-corr-selfaudit';
    await request(app).get(`/api/v1/audit/entries?correlationId=${marker}`).set(auth(tokenAdmin));

    const row = await AuditLog.findOne({
      action: AUDIT_ACTIONS.AUDIT_LOG_SEARCHED,
      'metadata.filter.correlationId': marker,
    });
    expect(row).toBeTruthy();
    expect(row.actorId).toBeTruthy();
    expect(row.metadata.returned).toBe(0);
    expect(row.metadata.includeMetadata).toBe(false);
  });
});
