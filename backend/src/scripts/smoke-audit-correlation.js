/**
 * Ad-hoc smoke test for Task #42 — AuditLog correlationId/branchId/resourceType/resourceId
 * (not part of Vitest).
 *
 * Verifies:
 *   (a) requestIdMiddleware attaches req.requestId, and AuditService.record(), when passed
 *       that req, writes an AuditLog row whose correlationId matches req.requestId exactly.
 *   (b) A branch-scoped action (appointment confirm, via AppointmentLifecycleService) writes
 *       an AuditLog row with branchId, resourceType, and resourceId populated.
 *   (c) Backward compatibility: calling AuditService.record() the "old" way (no req, no new
 *       fields) still succeeds and simply leaves the new fields null.
 */
import '../config/env.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import AuditLog from '../models/AuditLog.model.js';
import AuditService from '../services/AuditService.js';
import AppointmentRepository from '../repositories/AppointmentRepository.js';
import AppointmentLifecycleService from '../services/AppointmentLifecycleService.js';
import { requestIdMiddleware } from '../middlewares/requestId.middleware.js';
import { AUDIT_ACTIONS } from '../enums/auditAction.js';
import { APPOINTMENT_STATUS } from '../enums/appointment.js';
import { smokeDbUri } from './smokeDbUri.js';

function runMiddleware(mw, req, res) {
  return new Promise((resolve, reject) => {
    mw(req, res, (err) => (err ? reject(err) : resolve()));
  });
}

function makeRes() {
  const headers = {};
  return { setHeader: (k, v) => { headers[k] = v; }, headers };
}

async function main() {
  await mongoose.connect(smokeDbUri(config.mongo.uri, 'aurah360_smoke_audit_correlation'));
  await mongoose.connection.dropDatabase();

  const auditService = new AuditService();
  const actorId = new mongoose.Types.ObjectId();

  // (a) correlationId is auto-populated from req.requestId
  {
    const req = { headers: {}, ip: '127.0.0.1' };
    const res = makeRes();
    await runMiddleware(requestIdMiddleware, req, res);
    if (!req.requestId) throw new Error('Expected requestIdMiddleware to set req.requestId');

    await auditService.record(AUDIT_ACTIONS.LOGIN, {
      actorId,
      metadata: { via: 'smoke-test' },
      req,
    });

    const entry = await AuditLog.findOne({ action: AUDIT_ACTIONS.LOGIN, actorId }).exec();
    if (!entry) throw new Error('Expected an AuditLog row to be written');
    if (entry.correlationId !== req.requestId) {
      throw new Error(`Expected correlationId ${req.requestId}, got ${entry.correlationId}`);
    }
    console.log('(a) PASS: correlationId matches req.requestId', entry.correlationId);
  }

  // (b) branch-scoped action populates branchId/resourceType/resourceId
  {
    const appointmentRepository = new AppointmentRepository();
    const patientId = new mongoose.Types.ObjectId();
    const doctorId = new mongoose.Types.ObjectId();
    const branchId = new mongoose.Types.ObjectId();
    const serviceId = new mongoose.Types.ObjectId();

    const appointment = await appointmentRepository.model.create({
      appointmentNumber: 'SMOKE-AUDIT-0001',
      patientId,
      doctorId,
      branchId,
      serviceId,
      appointmentDate: new Date(),
      startTime: '10:00',
      endTime: '10:15',
      status: APPOINTMENT_STATUS.SCHEDULED,
    });

    const req = { headers: {}, ip: '127.0.0.1' };
    const res = makeRes();
    await runMiddleware(requestIdMiddleware, req, res);

    const lifecycleService = new AppointmentLifecycleService();
    await lifecycleService.confirm(appointment._id.toString(), actorId.toString(), req);

    const entry = await AuditLog.findOne({
      action: AUDIT_ACTIONS.APPOINTMENT_UPDATED,
      actorId: actorId.toString(),
    }).exec();
    if (!entry) throw new Error('Expected an APPOINTMENT_UPDATED AuditLog row to be written');
    if (!entry.branchId || entry.branchId.toString() !== branchId.toString()) {
      throw new Error(`Expected branchId ${branchId.toString()}, got ${entry.branchId}`);
    }
    if (entry.resourceType !== 'Appointment') {
      throw new Error(`Expected resourceType 'Appointment', got ${entry.resourceType}`);
    }
    if (entry.resourceId !== appointment._id.toString()) {
      throw new Error(`Expected resourceId ${appointment._id.toString()}, got ${entry.resourceId}`);
    }
    if (entry.correlationId !== req.requestId) {
      throw new Error(`Expected correlationId ${req.requestId}, got ${entry.correlationId}`);
    }
    console.log('(b) PASS: branchId/resourceType/resourceId populated for branch-scoped action', {
      branchId: entry.branchId.toString(),
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      correlationId: entry.correlationId,
    });
  }

  // (c) backward compatibility: old-style call sites (no req, no new fields) still work
  {
    await auditService.record(AUDIT_ACTIONS.LOGIN, { actorId, metadata: { legacy: true } });
    const entry = await AuditLog.findOne({ action: AUDIT_ACTIONS.LOGIN, actorId, 'metadata.legacy': true }).exec();
    if (!entry) throw new Error('Expected legacy-style call to still write an AuditLog row');
    if (entry.correlationId !== null || entry.branchId !== null || entry.resourceType !== null || entry.resourceId !== null) {
      throw new Error('Expected new fields to be null for a legacy-style call with no req/fields');
    }
    console.log('(c) PASS: legacy call site without req/new fields leaves them null, no crash');
  }

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log('SMOKE PASS');
}

main().catch((err) => {
  console.error('SMOKE FAIL', err);
  process.exit(1);
});
