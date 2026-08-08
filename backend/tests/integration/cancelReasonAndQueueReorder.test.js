import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import App from '../../src/app.js';
import '../../src/models/index.js'; // registers every model so populate() paths resolve
import User from '../../src/models/User.model.js';
import Role from '../../src/models/Role.model.js';
import Branch from '../../src/models/Branch.model.js';
import Patient from '../../src/models/Patient.model.js';
import Doctor from '../../src/models/Doctor.model.js';
import Appointment from '../../src/models/Appointment.model.js';
import QueueEntry from '../../src/models/QueueEntry.model.js';
import { hashPassword } from '../../src/helpers/crypto.helper.js';
import { ROLE_PERMISSIONS } from '../../src/constants/rolePermissions.js';
import { ROLE_LABELS } from '../../src/constants/roles.js';
import { APPOINTMENT_STATUS } from '../../src/enums/appointment.js';
import { AUDIT_ACTIONS } from '../../src/enums/auditAction.js';
import AuditLog from '../../src/models/AuditLog.model.js';

/**
 * A13 — cancelling an appointment must carry a reason (controlled code, or legacy free text).
 * A2  — a queue reorder ("Move Up") must carry a typed reason and be audited.
 *
 * Driven over real HTTP through the actual Express app (supertest, in-process) against a live
 * test database, mirroring auth.api.test.js's convention.
 */
describe('Cancel reason (A13) & queue reorder reason (A2) enforcement', () => {
  let app;
  let token;
  let branch;
  let doctor;
  let patient;
  const password = 'Password@12345';

  const makeAppointment = async () =>
    Appointment.create({
      appointmentNumber: `APT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      patientId: patient._id,
      doctorId: doctor._id,
      branchId: branch._id,
      serviceId: new mongoose.Types.ObjectId(),
      appointmentDate: new Date('2026-09-01'),
      startTime: '10:00',
      endTime: '10:15',
      status: APPOINTMENT_STATUS.SCHEDULED,
    });

  beforeAll(async () => {
    await connectTestDb('cancel-reorder');
    app = new App().getExpressApp();

    // RECEPTIONIST holds appointments.* and queue.manage, and is not in mfaRequiredRoles,
    // so login issues tokens directly (see auth.api.test.js).
    await Role.findOneAndUpdate(
      { code: 'RECEPTIONIST' },
      {
        code: 'RECEPTIONIST',
        name: ROLE_LABELS.RECEPTIONIST,
        permissions: ROLE_PERMISSIONS.RECEPTIONIST,
        isSystem: true,
        isActive: true,
      },
      { upsert: true }
    );

    const email = `reason-test-${Date.now()}@aurah360.local`;
    await User.create({
      firstName: 'Reason',
      lastName: 'Tester',
      email,
      employeeId: `EMP-${Date.now()}`,
      passwordHash: await hashPassword(password),
      role: 'RECEPTIONIST',
      isActive: true,
      status: 'ACTIVE',
    });
    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    token = login.body.data.accessToken;

    branch = await Branch.create({
      name: 'Reason Smoke Branch',
      branchCode: `RSB-${Date.now()}`,
      displayName: 'Reason Smoke Branch',
      email: `reason-branch-${Date.now()}@example.com`,
      phone: '9800000009',
    });
    patient = await Patient.create({
      mrn: `MRN-RSN-${Date.now()}`,
      firstName: 'Reason',
      lastName: 'Patient',
      gender: 'FEMALE',
      mobile: '9833333333',
      primaryBranchId: branch._id,
    });
    doctor = await Doctor.create({
      doctorCode: `DOC-${Date.now()}`,
      registrationNumber: `REG-${Date.now()}`,
      licenseNumber: `LIC-${Date.now()}`,
      userId: new mongoose.Types.ObjectId(),
      primaryBranchId: branch._id,
      branchIds: [branch._id],
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  const cancel = (id, body) =>
    request(app)
      .post(`/api/v1/appointments/${id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  it('rejects a bare cancel with no reason at all', async () => {
    const apt = await makeAppointment();
    const res = await cancel(apt.id, {});
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body)).toMatch(/reason is required/i);
  });

  it('rejects reasonCode OTHER without a free-text note', async () => {
    const apt = await makeAppointment();
    const res = await cancel(apt.id, { reasonCode: 'OTHER' });
    expect(res.status).toBe(422);
  });

  it('rejects a reasonCode outside the controlled list', async () => {
    const apt = await makeAppointment();
    const res = await cancel(apt.id, { reasonCode: 'BECAUSE_I_SAID_SO' });
    expect(res.status).toBe(422);
  });

  /**
   * The accepted path is asserted on persisted state rather than on the HTTP response body:
   * AppointmentLifecycleService.cancel() fires the cancellation notification, whose BullMQ
   * enqueue blocks when Redis is unavailable (as it is in plain local/test runs). The DB write
   * happens before that, so polling proves the request cleared validation and was applied.
   */
  const cancelAndAwaitPersist = async (id, body) => {
    cancel(id, body).catch(() => {});
    for (let i = 0; i < 60; i += 1) {
      const doc = await Appointment.findById(id);
      if (doc.status === APPOINTMENT_STATUS.CANCELLED) return doc;
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('appointment was never cancelled');
  };

  it('accepts a valid reasonCode and persists it', async () => {
    const apt = await makeAppointment();
    const doc = await cancelAndAwaitPersist(apt.id, { reasonCode: 'PATIENT_REQUEST' });
    expect(doc.cancellationReasonCode).toBe('PATIENT_REQUEST');
    expect(doc.cancelledAt).toBeTruthy();
  }, 30000);

  it('accepts reasonCode OTHER when a note is supplied', async () => {
    const apt = await makeAppointment();
    const doc = await cancelAndAwaitPersist(apt.id, {
      reasonCode: 'OTHER',
      reason: 'Power outage at clinic',
    });
    expect(doc.cancellationReasonCode).toBe('OTHER');
    expect(doc.cancellationReason).toBe('Power outage at clinic');
  }, 30000);

  it('stays backward-compatible with legacy free-text-only callers (mobile app)', async () => {
    const apt = await makeAppointment();
    const doc = await cancelAndAwaitPersist(apt.id, { reason: 'Cancelled by patient via app' });
    expect(doc.cancellationReasonCode).toBeNull();
    expect(doc.cancellationReason).toBe('Cancelled by patient via app');
  }, 30000);

  describe('queue reorder', () => {
    const makeEntry = async (sortOrder) => {
      const apt = await makeAppointment();
      return QueueEntry.create({
        tokenNumber: `T${sortOrder}${Date.now() % 1000}`,
        appointmentId: apt._id,
        patientId: patient._id,
        doctorId: doctor._id,
        branchId: branch._id,
        queueDate: new Date(),
        sortOrder,
      });
    };

    const reorder = (id, body) =>
      request(app)
        .post(`/api/v1/queue/${id}/reorder`)
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    it('rejects a reorder with no reason, and with a too-short reason', async () => {
      const first = await makeEntry(1);
      const last = await makeEntry(9);
      const noReason = await reorder(last.id, { beforeId: first.id });
      expect(noReason.status).toBe(422);
      const shortReason = await reorder(last.id, { beforeId: first.id, reason: 'ab' });
      expect(shortReason.status).toBe(422);
    });

    it('accepts a reorder with a typed reason and writes a QUEUE_REORDERED audit entry', async () => {
      const first = await makeEntry(2);
      const last = await makeEntry(8);
      const res = await reorder(last.id, {
        beforeId: first.id,
        reason: 'Elderly patient, doctor approved priority',
      });
      expect(res.status).toBe(200);
      const moved = await QueueEntry.findById(last.id);
      expect(moved.sortOrder).toBeLessThan(first.sortOrder);

      const audit = await AuditLog.findOne({
        action: AUDIT_ACTIONS.QUEUE_REORDERED,
        'metadata.queueEntryId': last.id,
      });
      expect(audit).toBeTruthy();
      expect(audit.metadata.reason).toBe('Elderly patient, doctor approved priority');
    });
  });
});
