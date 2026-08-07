/**
 * Ad-hoc smoke test for SEC-002 break-glass enforcement (not part of Vitest).
 *
 * Verifies requirePermissionOrBreakGlass (src/middlewares/permission.middleware.js):
 *   (a) a user without PATIENTS_VIEW/PATIENTS_ALL and without a break-glass grant is denied
 *   (b) the same user WITH an active break-glass grant for that specific patient is allowed,
 *       and a PHI_ACCESSED_UNDER_BREAK_GLASS audit entry is recorded
 *   (c) an EXPIRED break-glass grant does NOT allow access
 */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import BreakGlassAccess from '../models/BreakGlassAccess.model.js';
import AuditLog from '../models/AuditLog.model.js';
import { requirePermissionOrBreakGlass } from '../middlewares/permission.middleware.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';

function runMiddleware(mw, req) {
  return new Promise((resolve, reject) => {
    const res = {};
    mw(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function main() {
  await mongoose.connect(config.mongo.uri.replace(/\/([^/?]+)$/, '/aurah360_smoke_breakglass'));
  await mongoose.connection.dropDatabase();

  const userId = new mongoose.Types.ObjectId();
  const patientId = new mongoose.Types.ObjectId();
  const otherPatientId = new mongoose.Types.ObjectId();

  const middleware = requirePermissionOrBreakGlass('id', PERMISSIONS.PATIENTS_VIEW, PERMISSIONS.PATIENTS_ALL);

  const makeReq = (targetPatientId) => ({
    auth: { userId: userId.toString(), role: 'RECEPTIONIST', permissions: [] },
    params: { id: targetPatientId.toString() },
    originalUrl: `/api/v1/patients/${targetPatientId.toString()}`,
    method: 'GET',
    ip: '127.0.0.1',
    headers: {},
  });

  // (a) No permission, no break-glass grant -> denied
  {
    const req = makeReq(patientId);
    let denied = false;
    try {
      await runMiddleware(middleware, req);
    } catch (err) {
      denied = true;
      if (err.statusCode !== 403) throw new Error(`Expected 403, got ${err.statusCode}`);
    }
    if (!denied) throw new Error('Expected access to be denied without permission or break-glass grant');
    console.log('(a) PASS: denied without permission and without break-glass grant');
  }

  // (b) Active break-glass grant scoped to this exact patient -> allowed + audited
  {
    const grant = await BreakGlassAccess.create({
      userId,
      patientId,
      resourceType: 'PATIENT_RECORD',
      reason: 'Emergency review during on-call coverage',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const req = makeReq(patientId);
    await runMiddleware(middleware, req);
    if (!req.breakGlassAccess) throw new Error('Expected req.breakGlassAccess to be set to true');
    console.log('(b) PASS: allowed through with active break-glass grant', grant._id.toString());

    const auditEntry = await AuditLog.findOne({
      action: AUDIT_ACTIONS.PHI_ACCESSED_UNDER_BREAK_GLASS,
      actorId: userId,
    }).exec();
    if (!auditEntry) throw new Error('Expected a PHI_ACCESSED_UNDER_BREAK_GLASS audit entry to be recorded');
    if (String(auditEntry.metadata?.patientId) !== patientId.toString()) {
      throw new Error('Audit entry metadata.patientId did not match the accessed patient');
    }
    console.log('(b) PASS: PHI_ACCESSED_UNDER_BREAK_GLASS audit entry recorded distinctly', auditEntry._id.toString());

    // Same grant must NOT extend access to a different patient (scope must match exactly).
    const otherReq = makeReq(otherPatientId);
    let deniedForOtherPatient = false;
    try {
      await runMiddleware(middleware, otherReq);
    } catch (err) {
      deniedForOtherPatient = true;
      if (err.statusCode !== 403) throw new Error(`Expected 403, got ${err.statusCode}`);
    }
    if (!deniedForOtherPatient) {
      throw new Error('Break-glass grant for one patient must not grant access to a different patient');
    }
    console.log('(b) PASS: break-glass grant did not leak access to a different patient');
  }

  // (c) Expired break-glass grant -> denied
  {
    const expiredPatientId = new mongoose.Types.ObjectId();
    await BreakGlassAccess.create({
      userId,
      patientId: expiredPatientId,
      resourceType: 'PATIENT_RECORD',
      reason: 'Expired grant for smoke test',
      expiresAt: new Date(Date.now() - 60 * 1000), // already expired
    });

    const req = makeReq(expiredPatientId);
    let denied = false;
    try {
      await runMiddleware(middleware, req);
    } catch (err) {
      denied = true;
      if (err.statusCode !== 403) throw new Error(`Expected 403, got ${err.statusCode}`);
    }
    if (!denied) throw new Error('Expected access to be denied for an expired break-glass grant');
    console.log('(c) PASS: denied with an expired break-glass grant');
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
