import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import Appointment from '../../src/models/Appointment.model.js';

/**
 * APT-008 / §18.3 concurrency edge case: "two users attempt the last slot ... simultaneously;
 * only valid transaction commits." This proves the unique sparse index on idempotencyKey — the
 * exact mechanism AppointmentService.create() relies on — actually rejects a concurrent duplicate
 * at the database layer, against a real MongoDB instance (not mocked).
 */
describe('Appointment idempotency (real DB)', () => {
  beforeAll(async () => {
    await connectTestDb('appointment-idempotency');
    // Mongoose builds schema-declared indexes asynchronously in the background; the unique
    // constraint under test is not actually enforced until the index build completes.
    await Appointment.init();
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  const baseAppointment = () => ({
    appointmentNumber: `APT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    patientId: new mongoose.Types.ObjectId(),
    doctorId: new mongoose.Types.ObjectId(),
    branchId: new mongoose.Types.ObjectId(),
    serviceId: new mongoose.Types.ObjectId(),
    appointmentDate: new Date('2026-09-01'),
    startTime: '10:00',
    endTime: '10:15',
  });

  it('rejects a second insert with the same idempotencyKey', async () => {
    const idempotencyKey = `idem-${Date.now()}`;
    await Appointment.create({ ...baseAppointment(), idempotencyKey });

    await expect(
      Appointment.create({ ...baseAppointment(), idempotencyKey })
    ).rejects.toMatchObject({ code: 11000 });

    const count = await Appointment.countDocuments({ idempotencyKey });
    expect(count).toBe(1);
  });

  it('allows two appointments with no idempotencyKey (sparse index does not block nulls)', async () => {
    await Appointment.create(baseAppointment());
    await Appointment.create(baseAppointment());
    const count = await Appointment.countDocuments({ idempotencyKey: null });
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('allows two different idempotencyKeys to coexist', async () => {
    await Appointment.create({ ...baseAppointment(), idempotencyKey: `a-${Date.now()}` });
    await Appointment.create({ ...baseAppointment(), idempotencyKey: `b-${Date.now()}` });
    // No assertion needed beyond "did not throw" — both inserts must succeed.
  });
});
