import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import Appointment from '../../src/models/Appointment.model.js';
import Branch from '../../src/models/Branch.model.js';
import Doctor from '../../src/models/Doctor.model.js';
import DoctorSchedule from '../../src/models/DoctorSchedule.model.js';
import Master from '../../src/models/Master.model.js';
import Patient from '../../src/models/Patient.model.js';
import Room from '../../src/models/Room.model.js';
// Registered for its side effect only: findByIdPopulated() populates doctorId.userId.
import '../../src/models/User.model.js';
import AppointmentService from '../../src/services/AppointmentService.js';
import { APPOINTMENT_STATUS } from '../../src/enums/appointment.js';
import { MASTER_TYPES } from '../../src/constants/masterTypes.js';

/**
 * APT-001 / NFR-004 / §2.4 "zero system-permitted double-booking".
 *
 * The defect: #assertSlot did a plain READ to detect a clash and then an unguarded insert. Two
 * receptionists submitting the same doctor-minute with DIFFERENT idempotency keys both passed the
 * read (neither had committed yet) and both inserted. Idempotency never helped — it only ever
 * deduplicated a retry of the SAME request.
 *
 * The fix is two-layered and this suite pins both layers plus, just as hard, everything that must
 * KEEP working:
 *
 *   1. a partial unique index on (doctorId, appointmentDate, startTime), filtered to the
 *      capacity-consuming statuses — enforced by the storage engine, so it holds even against a
 *      writer that never goes through the service;
 *   2. a per-resource-day mutex inside a transaction, for the partial OVERLAPS an equality index
 *      structurally cannot express.
 *
 * A constraint that blocks everything is an outage, not a fix, so the "must still work" cases —
 * rebooking a cancelled/no-show slot, concurrent bookings across different doctors, branches and
 * days, and proposing an already-taken slot for approval — are asserted with the same weight.
 */
describe('APT-001 double-booking is impossible under concurrency', () => {
  const service = new AppointmentService();

  /** A Monday in the future, so the branch (all days working) is open. */
  const DATE = new Date(2026, 8, 7, 0, 0, 0, 0);
  const OTHER_DATE = new Date(2026, 8, 8, 0, 0, 0, 0);

  let branch;
  let otherBranch;
  let doctorA;
  let doctorB;
  let serviceMaster;
  let patients;
  let roomOccupied;
  let roomFree;

  const makeDoctor = async (code) => {
    const doctor = await Doctor.create({
      userId: new mongoose.Types.ObjectId(),
      doctorCode: code,
      licenseNumber: `LIC-${code}`,
      registrationNumber: `REG-${code}`,
    });
    // Same weekly grid on both test days, at both branches the doctor may sit in.
    for (const day of [DATE, OTHER_DATE]) {
      // eslint-disable-next-line no-await-in-loop
      await DoctorSchedule.create({
        doctorId: doctor._id,
        branchId: branch._id,
        dayOfWeek: day.getDay(),
        startTime: '10:00',
        endTime: '13:00',
        lunchStart: null,
        lunchEnd: null,
        slotDuration: 15,
        bufferTime: 0,
        maximumAppointments: 0,
      });
    }
    return doctor;
  };

  const makeBranch = (code) =>
    Branch.create({
      name: `Branch ${code}`,
      displayName: `Branch ${code}`,
      branchCode: code,
      phone: '9999999999',
      email: `${code.toLowerCase()}@dblbook.test`,
      settings: {
        workingDays: [0, 1, 2, 3, 4, 5, 6],
        weeklySchedule: [],
        lunchBreak: { enabled: false },
        timeSlotDurationMinutes: 15,
        appointmentBufferMinutes: 0,
        holidayCalendar: [],
      },
    });

  const booking = (overrides = {}) => ({
    patientId: patients[0]._id.toString(),
    doctorId: doctorA._id.toString(),
    branchId: branch._id.toString(),
    serviceId: serviceMaster._id.toString(),
    appointmentDate: DATE,
    startTime: '10:00',
    endTime: '10:15',
    ...overrides,
  });

  beforeAll(async () => {
    await connectTestDb('dblbook');
    // Mongoose builds schema indexes in the background; the constraint under test is not
    // enforced until that build finishes.
    await Appointment.init();

    branch = await makeBranch('DB1');
    otherBranch = await makeBranch('DB2');
    doctorA = await makeDoctor('DBDOC-A');
    doctorB = await makeDoctor('DBDOC-B');

    serviceMaster = await Master.create({
      type: MASTER_TYPES.SERVICE,
      name: 'Double-booking test consult',
      durationMinutes: null,
    });

    patients = await Promise.all(
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) =>
        Patient.create({
          mrn: `DBMRN${n}`,
          firstName: 'Race',
          lastName: `Patient${n}`,
          gender: 'MALE',
          mobile: `988000000${n}`,
          primaryBranchId: branch._id,
        })
      )
    );

    roomOccupied = await Room.create({
      branchId: branch._id,
      name: 'Laser Room',
      code: 'DBR1',
      capacity: 1,
      cleaningBufferMinutes: 0,
    });
    roomFree = await Room.create({
      branchId: branch._id,
      name: 'Spare Room',
      code: 'DBR2',
      capacity: 1,
      cleaningBufferMinutes: 0,
    });
  });

  beforeEach(async () => {
    await Appointment.deleteMany({});
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  // ---------------------------------------------------------------------------------
  describe('the database constraint itself', () => {
    it('declares a UNIQUE index on the doctor-minute, filtered to capacity-consuming statuses', async () => {
      const indexes = await Appointment.collection.indexes();
      const guard = indexes.find((i) => i.name === 'uniq_doctor_committed_slot');

      expect(guard).toBeTruthy();
      expect(guard.unique).toBe(true);
      expect(guard.key).toEqual({ doctorId: 1, appointmentDate: 1, startTime: 1 });
      // Partial, or it would block rebooking a cancelled slot.
      expect(guard.partialFilterExpression.deletedAt).toBe(null);
      expect(guard.partialFilterExpression.status.$in).toContain(APPOINTMENT_STATUS.SCHEDULED);
      expect(guard.partialFilterExpression.status.$in).not.toContain(APPOINTMENT_STATUS.CANCELLED);
      expect(guard.partialFilterExpression.status.$in).not.toContain(APPOINTMENT_STATUS.NO_SHOW);
    });

    it('lets exactly ONE of 8 CONCURRENT raw inserts for one doctor-minute commit', async () => {
      // The service layer is deliberately bypassed here, so nothing but the index is under test:
      // this is the assertion that fails the moment the unique index is removed, whatever the
      // service does. Same slot, same day, same doctor, eight simultaneous writers.
      const results = await Promise.allSettled(
        [0, 1, 2, 3, 4, 5, 6, 7].map((n) =>
          Appointment.collection.insertOne({
            appointmentNumber: `APT-RACE-${n}`,
            patientId: patients[n]._id,
            doctorId: doctorA._id,
            branchId: branch._id,
            serviceId: serviceMaster._id,
            appointmentDate: DATE,
            startTime: '10:00',
            endTime: '10:15',
            status: APPOINTMENT_STATUS.SCHEDULED,
            deletedAt: null,
          })
        )
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await Appointment.countDocuments({ deletedAt: null })).toBe(1);
      for (const rejected of results.filter((r) => r.status === 'rejected')) {
        expect(rejected.reason.code).toBe(11000);
      }
    });

    it('blocks a raw insert that never goes through the service layer', async () => {
      await service.create(booking());

      // The whole point of pushing this to the DB: a writer that skips every service check —
      // a script, a migration, another process — still cannot double-book.
      await expect(
        Appointment.collection.insertOne({
          appointmentNumber: 'APT-RAW-001',
          patientId: patients[1]._id,
          doctorId: doctorA._id,
          branchId: branch._id,
          serviceId: serviceMaster._id,
          appointmentDate: DATE,
          startTime: '10:00',
          endTime: '10:15',
          status: APPOINTMENT_STATUS.CONFIRMED,
          deletedAt: null,
        })
      ).rejects.toMatchObject({ code: 11000 });

      expect(await Appointment.countDocuments({})).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------------
  describe('concurrent bookings for the same doctor-minute', () => {
    it('lets exactly ONE of 6 simultaneous bookings with DIFFERENT idempotency keys win', async () => {
      const attempts = [0, 1, 2, 3, 4, 5].map((n) =>
        service.create(
          booking({
            patientId: patients[n]._id.toString(),
            // Different keys — so idempotency deduplication cannot be what saves us here.
            idempotencyKey: `race-key-${n}`,
          })
        )
      );

      const results = await Promise.allSettled(attempts);
      const won = results.filter((r) => r.status === 'fulfilled');
      const lost = results.filter((r) => r.status === 'rejected');

      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(5);
      expect(await Appointment.countDocuments({ deletedAt: null })).toBe(1);
    });

    it('answers every loser with a clean 409, never a raw Mongo duplicate-key error', async () => {
      const results = await Promise.allSettled(
        [0, 1, 2, 3, 4, 5].map((n) =>
          service.create(booking({ patientId: patients[n]._id.toString(), idempotencyKey: `clean-${n}` }))
        )
      );

      const errors = results.filter((r) => r.status === 'rejected').map((r) => r.reason);
      expect(errors).toHaveLength(5);
      for (const err of errors) {
        expect(err.name).toBe('ApiError');
        expect(err.statusCode).toBe(409);
        // A string code, not Mongo's numeric 11000, and a message a receptionist can act on.
        expect(typeof err.code).toBe('string');
        expect(err.message).not.toMatch(/E11000|duplicate key|index:/i);
        // Names the slot that was lost, so the message is actionable.
        expect(err.message).toMatch(/10:00/);
        expect(err.code).toBe('DOCTOR_SLOT_TAKEN');
      }
    });

    it('serializes PARTIAL overlaps too, which the equality index cannot catch', async () => {
      // 10:00–10:30 and 10:15–10:45 share no (doctor, date, startTime) key, so only the
      // transaction + per-doctor-day mutex can stop them both committing.
      const results = await Promise.allSettled([
        service.create(
          booking({ patientId: patients[0]._id.toString(), startTime: '10:00', endTime: '10:30' })
        ),
        service.create(
          booking({ patientId: patients[1]._id.toString(), startTime: '10:15', endTime: '10:45' })
        ),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await Appointment.countDocuments({ deletedAt: null })).toBe(1);

      const loser = results.find((r) => r.status === 'rejected').reason;
      expect(loser.statusCode).toBe(409);
      expect(loser.message).toMatch(/time range/i);
    });

    it('still deduplicates a retry of the SAME idempotency key into one booking', async () => {
      const key = 'retry-same-key';
      const results = await Promise.allSettled([
        service.create(booking({ idempotencyKey: key })),
        service.create(booking({ idempotencyKey: key })),
      ]);

      expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
      const [a, b] = results.map((r) => r.value);
      expect(a.id).toBe(b.id);
      expect(await Appointment.countDocuments({ deletedAt: null })).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------------
  describe('what the constraint must NOT block', () => {
    it('rebooks a slot whose appointment was CANCELLED', async () => {
      const first = await service.create(booking());
      await Appointment.updateOne(
        { _id: first.id },
        { status: APPOINTMENT_STATUS.CANCELLED, cancelledAt: new Date() }
      );

      const second = await service.create(booking({ patientId: patients[1]._id.toString() }));
      expect(second.id).not.toBe(first.id);
      expect(second.startTime).toBe('10:00');
    });

    it('rebooks a slot whose appointment was marked NO_SHOW', async () => {
      const first = await service.create(booking());
      await Appointment.updateOne({ _id: first.id }, { status: APPOINTMENT_STATUS.NO_SHOW });

      const second = await service.create(booking({ patientId: patients[1]._id.toString() }));
      expect(second.id).not.toBe(first.id);
    });

    it('rebooks a slot whose appointment was soft-deleted', async () => {
      const first = await service.create(booking());
      await Appointment.updateOne({ _id: first.id }, { deletedAt: new Date() });

      await expect(
        service.create(booking({ patientId: patients[1]._id.toString() }))
      ).resolves.toBeTruthy();
    });

    it('lets DIFFERENT doctors be booked for the same minute concurrently — all succeed', async () => {
      const results = await Promise.allSettled([
        service.create(booking({ doctorId: doctorA._id.toString(), patientId: patients[0]._id.toString() })),
        service.create(booking({ doctorId: doctorB._id.toString(), patientId: patients[1]._id.toString() })),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
      expect(await Appointment.countDocuments({ deletedAt: null })).toBe(2);
    });

    it('lets the SAME doctor be booked for the same minute on different days concurrently', async () => {
      const results = await Promise.allSettled([
        service.create(booking({ appointmentDate: DATE, patientId: patients[0]._id.toString() })),
        service.create(booking({ appointmentDate: OTHER_DATE, patientId: patients[1]._id.toString() })),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
      expect(await Appointment.countDocuments({ deletedAt: null })).toBe(2);
    });

    it('lets consecutive non-overlapping slots be booked concurrently', async () => {
      const results = await Promise.allSettled([
        service.create(booking({ patientId: patients[0]._id.toString(), startTime: '10:00', endTime: '10:15' })),
        service.create(booking({ patientId: patients[1]._id.toString(), startTime: '10:15', endTime: '10:30' })),
        service.create(booking({ patientId: patients[2]._id.toString(), startTime: '10:30', endTime: '10:45' })),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    });

    it('still lets a patient PROPOSE an already-taken slot for approval (APT-003)', async () => {
      await service.create(booking());

      // A proposal claims no capacity: the approver's job is to accept, counter-offer or reject.
      const proposal = await service.create(
        booking({ patientId: patients[1]._id.toString(), requiresApproval: true })
      );
      expect(proposal.status).toBe(APPOINTMENT_STATUS.PENDING_APPROVAL);
    });
  });

  // ---------------------------------------------------------------------------------
  describe('APT-001 room/device re-validation on update', () => {
    it('refuses to MOVE an appointment into an already-occupied room', async () => {
      await service.create(
        booking({ patientId: patients[0]._id.toString(), roomId: roomOccupied._id.toString() })
      );
      const mover = await service.create({
        patientId: patients[1]._id.toString(),
        doctorId: doctorB._id.toString(),
        branchId: branch._id.toString(),
        serviceId: serviceMaster._id.toString(),
        appointmentDate: DATE,
        startTime: '10:00',
        endTime: '10:15',
      });

      // Before the fix `update` only re-validated on date/time/doctor/branch, so a roomId-only
      // PATCH walked straight into an occupied room and answered 200.
      await expect(
        service.update(mover.id, { roomId: roomOccupied._id.toString() })
      ).rejects.toMatchObject({ statusCode: 409, code: 'ROOM_UNAVAILABLE' });
    });

    it('allows moving that same appointment into a FREE room', async () => {
      await service.create(
        booking({ patientId: patients[0]._id.toString(), roomId: roomOccupied._id.toString() })
      );
      const mover = await service.create({
        patientId: patients[1]._id.toString(),
        doctorId: doctorB._id.toString(),
        branchId: branch._id.toString(),
        serviceId: serviceMaster._id.toString(),
        appointmentDate: DATE,
        startTime: '10:00',
        endTime: '10:15',
      });

      const moved = await service.update(mover.id, { roomId: roomFree._id.toString() });
      expect(moved.roomId).toBe(roomFree._id.toString());
    });

    it('re-checks the room an appointment KEEPS when only its time moves', async () => {
      // Room busy 10:30–10:45 under another doctor…
      await service.create({
        patientId: patients[0]._id.toString(),
        doctorId: doctorB._id.toString(),
        branchId: branch._id.toString(),
        serviceId: serviceMaster._id.toString(),
        appointmentDate: DATE,
        startTime: '10:30',
        endTime: '10:45',
        roomId: roomOccupied._id.toString(),
      });
      // …and this one holds it at 10:00–10:15.
      const mover = await service.create(
        booking({ patientId: patients[1]._id.toString(), roomId: roomOccupied._id.toString() })
      );

      // `next` used to carry no room at all, so a time-only move never re-checked the room it kept.
      await expect(
        service.update(mover.id, { startTime: '10:30', endTime: '10:45' })
      ).rejects.toMatchObject({ statusCode: 409, code: 'ROOM_UNAVAILABLE' });
    });

    it('refuses to RESCHEDULE onto a doctor-minute another appointment already holds', async () => {
      await service.create(booking({ patientId: patients[0]._id.toString() }));
      const mover = await service.create(
        booking({ patientId: patients[1]._id.toString(), startTime: '10:30', endTime: '10:45' })
      );

      await expect(
        service.update(mover.id, { startTime: '10:00', endTime: '10:15' })
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('leaves a non-resource PATCH (notes only) working without slot re-validation', async () => {
      const appt = await service.create(booking());
      const patched = await service.update(appt.id, { notes: 'Bring previous reports' });
      expect(patched.notes).toBe('Bring previous reports');
    });
  });

  // ---------------------------------------------------------------------------------
  it('keeps multi-branch concurrency working for two different doctors', async () => {
    await DoctorSchedule.create({
      doctorId: doctorB._id,
      branchId: otherBranch._id,
      dayOfWeek: DATE.getDay(),
      startTime: '10:00',
      endTime: '13:00',
      lunchStart: null,
      lunchEnd: null,
      slotDuration: 15,
      bufferTime: 0,
      maximumAppointments: 0,
    });

    const results = await Promise.allSettled([
      service.create(booking({ patientId: patients[0]._id.toString() })),
      service.create(
        booking({
          patientId: patients[1]._id.toString(),
          doctorId: doctorB._id.toString(),
          branchId: otherBranch._id.toString(),
        })
      ),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
  });
});
