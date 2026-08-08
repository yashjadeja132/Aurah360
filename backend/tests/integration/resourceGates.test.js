import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';

import Room from '../../src/models/Room.model.js';
import Device from '../../src/models/Device.model.js';
import StaffSkill from '../../src/models/StaffSkill.model.js';
import Master from '../../src/models/Master.model.js';
import Branch from '../../src/models/Branch.model.js';
import Doctor from '../../src/models/Doctor.model.js';
import Patient from '../../src/models/Patient.model.js';
import Appointment from '../../src/models/Appointment.model.js';
import DoctorSchedule from '../../src/models/DoctorSchedule.model.js';
// Registered for its side effect only: AppointmentRepository.findByIdPopulated populates the
// doctor's `userId`, which mongoose cannot resolve unless the User model has been loaded.
import '../../src/models/User.model.js';

import ResourceService from '../../src/services/ResourceService.js';
import AppointmentConflictService from '../../src/services/AppointmentConflictService.js';
import DoctorAvailabilityService from '../../src/services/DoctorAvailabilityService.js';
import AppointmentService from '../../src/services/AppointmentService.js';

import { MASTER_TYPES } from '../../src/constants/masterTypes.js';
import { APPOINTMENT_STATUS } from '../../src/enums/appointment.js';

/**
 * RSC-001 — the resources & scheduling settings that used to be configuration enforcing nothing:
 * device maintenance due dates, room cleaning turnover, room capacity, skill supervision,
 * service durations and the doctor's daily appointment cap.
 *
 * Every blocking case below has a matching NON-blocking case, because the failure mode of a gate
 * like this is not "it does not fire" but "it fires when nothing was configured" and turns an
 * ordinary clinic day into an outage.
 */
describe('RSC-001 resource & scheduling gates', () => {
  const resourceService = new ResourceService();
  const conflictService = new AppointmentConflictService();
  const availabilityService = new DoctorAvailabilityService();
  const appointmentService = new AppointmentService();

  const oid = () => new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await connectTestDb('resgates');
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  // --- 1. Device maintenance due date -------------------------------------------------
  describe('Device.nextMaintenanceDueAt gates bookability', () => {
    const makeDevice = (extra = {}) =>
      Device.create({
        branchId: oid(),
        name: 'Laser A',
        code: `DEV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        ...extra,
      });

    it('does not restrict a device with no maintenance schedule configured', async () => {
      const device = await makeDevice({ nextMaintenanceDueAt: null });
      expect(await resourceService.isDeviceAvailable(device._id)).toBe(true);
      await expect(resourceService.assertDeviceBookable(device._id)).resolves.toBeTruthy();
    });

    it('does not restrict a device whose maintenance is not yet due', async () => {
      const device = await makeDevice({
        nextMaintenanceDueAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      });
      expect(await resourceService.isDeviceAvailable(device._id)).toBe(true);
      await expect(resourceService.assertDeviceBookable(device._id)).resolves.toBeTruthy();
    });

    it('blocks a device whose maintenance due date has passed', async () => {
      const device = await makeDevice({
        nextMaintenanceDueAt: new Date(Date.now() - 24 * 3600 * 1000),
      });
      expect(await resourceService.isDeviceAvailable(device._id)).toBe(false);
      await expect(resourceService.assertDeviceBookable(device._id)).rejects.toMatchObject({
        code: 'DEVICE_MAINTENANCE_OVERDUE',
      });
    });

    it('judges the due date at the moment of USE, not at booking time', async () => {
      const dueAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      const device = await makeDevice({ nextMaintenanceDueAt: dueAt });

      const beforeDue = new Date(dueAt.getTime() - 24 * 3600 * 1000);
      const afterDue = new Date(dueAt.getTime() + 24 * 3600 * 1000);

      expect(await resourceService.isDeviceAvailable(device._id, beforeDue)).toBe(true);
      expect(await resourceService.isDeviceAvailable(device._id, afterDue)).toBe(false);
      await expect(
        resourceService.assertDeviceBookable(device._id, afterDue)
      ).rejects.toMatchObject({ code: 'DEVICE_MAINTENANCE_OVERDUE' });
    });

    it('names the device and the due date in the error so staff know what to change', async () => {
      const device = await makeDevice({
        name: 'Nd:YAG Unit 2',
        nextMaintenanceDueAt: new Date('2020-03-04'),
      });
      await expect(resourceService.assertDeviceBookable(device._id)).rejects.toThrow(
        /Nd:YAG Unit 2.*2020-03-04.*nextMaintenanceDueAt/s
      );
    });
  });

  // --- 2 & 3. Room cleaning buffer and capacity ---------------------------------------
  describe('Room.cleaningBufferMinutes and Room.capacity gate room conflicts', () => {
    const date = new Date(2026, 8, 7, 0, 0, 0, 0);
    let roomId;

    const book = (startTime, endTime, status = APPOINTMENT_STATUS.SCHEDULED) =>
      Appointment.create({
        appointmentNumber: `APT-${Math.random().toString(36).slice(2, 9)}`,
        patientId: oid(),
        doctorId: oid(),
        branchId: oid(),
        serviceId: oid(),
        appointmentDate: date,
        startTime,
        endTime,
        roomId,
        status,
      });

    const check = (startTime, endTime, opts = {}) =>
      conflictService.assertResourceAvailable({
        field: 'roomId',
        resourceId: roomId,
        date,
        startTime,
        endTime,
        ...opts,
      });

    beforeEach(async () => {
      await Appointment.deleteMany({});
      roomId = oid();
    });

    it('with no buffer configured, back-to-back bookings are allowed', async () => {
      await book('10:00', '10:30');
      await expect(check('10:30', '11:00', { bufferMinutes: 0 })).resolves.toBe(true);
    });

    it('still rejects a true overlap at the default capacity of 1', async () => {
      await book('10:00', '10:30');
      await expect(check('10:15', '10:45')).rejects.toMatchObject({ code: 'ROOM_UNAVAILABLE' });
    });

    it('rejects a booking inside the cleaning turnover window', async () => {
      await book('10:00', '10:30');
      await expect(check('10:30', '11:00', { bufferMinutes: 15 })).rejects.toMatchObject({
        code: 'ROOM_CLEANING_BUFFER',
      });
    });

    it('allows a booking that clears the cleaning turnover window', async () => {
      await book('10:00', '10:30');
      await expect(check('10:45', '11:15', { bufferMinutes: 15 })).resolves.toBe(true);
    });

    it('applies the turnover window on both sides of an existing booking', async () => {
      await book('11:00', '11:30');
      await expect(check('10:30', '10:55', { bufferMinutes: 15 })).rejects.toMatchObject({
        code: 'ROOM_CLEANING_BUFFER',
      });
    });

    it('lets a capacity-3 room hold three concurrent bookings and refuses the fourth', async () => {
      await book('10:00', '11:00');
      await book('10:00', '11:00');
      await expect(check('10:15', '10:45', { capacity: 3 })).resolves.toBe(true);

      await book('10:00', '11:00');
      await expect(check('10:15', '10:45', { capacity: 3 })).rejects.toMatchObject({
        code: 'ROOM_UNAVAILABLE',
      });
    });

    it('names the capacity in the error for a multi-occupant room', async () => {
      await book('10:00', '11:00');
      await book('10:00', '11:00');
      await expect(check('10:15', '10:45', { capacity: 2 })).rejects.toThrow(/capacity of 2/);
    });

    it('does not count cancelled bookings against capacity or turnover', async () => {
      await book('10:00', '10:30', APPOINTMENT_STATUS.CANCELLED);
      await expect(check('10:15', '10:45', { bufferMinutes: 30 })).resolves.toBe(true);
    });
  });

  // --- 4. Staff skill supervision ------------------------------------------------------
  describe('StaffSkill.requiresSupervision / supervisorId', () => {
    const grant = (extra) =>
      StaffSkill.create({
        userId: oid(),
        skillCode: 'LASER',
        name: 'Laser operation',
        ...extra,
      });

    it('leaves an ordinary unsupervised grant completely unaffected', async () => {
      const userId = oid();
      await grant({ userId, requiresSupervision: false });
      await expect(resourceService.assertOperatorSkilled(userId, 'LASER')).resolves.toBe(true);
    });

    it('keeps enforcing credential expiry (pre-existing gate must not regress)', async () => {
      const userId = oid();
      await grant({ userId, expiresAt: new Date(Date.now() - 1000) });
      await expect(resourceService.assertOperatorSkilled(userId, 'LASER')).rejects.toMatchObject({
        code: 'OPERATOR_SKILL_EXPIRED',
      });
    });

    it('allows a supervised operator whose named supervisor is independently credentialed', async () => {
      const userId = oid();
      const supervisorId = oid();
      await grant({ userId: supervisorId, requiresSupervision: false });
      await grant({ userId, requiresSupervision: true, supervisorId });
      await expect(resourceService.assertOperatorSkilled(userId, 'LASER')).resolves.toBe(true);
    });

    it('blocks a supervised operator whose supervisor holds no credential for the skill', async () => {
      const userId = oid();
      await grant({ userId, requiresSupervision: true, supervisorId: oid() });
      await expect(resourceService.assertOperatorSkilled(userId, 'LASER')).rejects.toMatchObject({
        code: 'OPERATOR_SUPERVISOR_NOT_QUALIFIED',
      });
    });

    it('blocks a supervised operator whose supervisor is themselves supervised', async () => {
      const userId = oid();
      const supervisorId = oid();
      await grant({ userId: supervisorId, requiresSupervision: true, supervisorId: oid() });
      await grant({ userId, requiresSupervision: true, supervisorId });
      await expect(resourceService.assertOperatorSkilled(userId, 'LASER')).rejects.toMatchObject({
        code: 'OPERATOR_SUPERVISOR_NOT_QUALIFIED',
      });
    });

    it('blocks a supervision-required grant with no supervisor at all', async () => {
      const userId = oid();
      await grant({ userId, requiresSupervision: true, supervisorId: null });
      await expect(resourceService.assertOperatorSkilled(userId, 'LASER')).rejects.toMatchObject({
        code: 'OPERATOR_SUPERVISION_REQUIRED',
      });
    });

    it('accepts a caller-supplied supervisor in place of the standing one', async () => {
      const userId = oid();
      const standIn = oid();
      await grant({ userId: standIn, requiresSupervision: false });
      await grant({ userId, requiresSupervision: true, supervisorId: oid() });
      await expect(
        resourceService.assertOperatorSkilled(userId, 'LASER', null, { supervisorUserId: standIn })
      ).resolves.toBe(true);
    });

    it('refuses to create a supervision-required grant with no supervisor', async () => {
      await expect(
        resourceService.grantSkill(
          { userId: oid(), skillCode: 'PEEL', name: 'Peel', requiresSupervision: true },
          null
        )
      ).rejects.toMatchObject({ code: 'SUPERVISOR_REQUIRED' });
    });

    it('refuses a self-supervising grant', async () => {
      const userId = oid();
      await expect(
        resourceService.grantSkill(
          { userId, skillCode: 'PEEL', name: 'Peel', requiresSupervision: true, supervisorId: userId },
          null
        )
      ).rejects.toMatchObject({ code: 'SUPERVISOR_INVALID' });
    });

    it('still creates an ordinary grant without a supervisor', async () => {
      const created = await resourceService.grantSkill(
        { userId: oid(), skillCode: 'FACIAL', name: 'Facial' },
        null
      );
      expect(created.requiresSupervision).toBe(false);
    });
  });

  // --- 5. Service durationMinutes + doctor daily cap -----------------------------------
  describe('Service durationMinutes and DoctorSchedule.maximumAppointments', () => {
    /** A Monday, so the branch (working days Mon-Sat) is open. */
    const date = new Date(2026, 8, 7, 0, 0, 0, 0);
    const dayOfWeek = date.getDay();

    let branch;
    let doctor;
    let patients;

    async function makeSchedule({ maximumAppointments = 0, bufferTime = 0 } = {}) {
      await DoctorSchedule.deleteMany({});
      return DoctorSchedule.create({
        doctorId: doctor._id,
        branchId: branch._id,
        dayOfWeek,
        startTime: '10:00',
        endTime: '13:00',
        lunchStart: null,
        lunchEnd: null,
        slotDuration: 15,
        bufferTime,
        maximumAppointments,
      });
    }

    async function makeService(durationMinutes) {
      return Master.create({
        type: MASTER_TYPES.SERVICE,
        name: `Service ${Math.random().toString(36).slice(2, 9)}`,
        durationMinutes,
      });
    }

    const bookingFor = (service, patientIndex, startTime, endTime) => ({
      patientId: patients[patientIndex]._id.toString(),
      doctorId: doctor._id.toString(),
      branchId: branch._id.toString(),
      serviceId: service._id.toString(),
      appointmentDate: date,
      startTime,
      endTime,
    });

    beforeAll(async () => {
      branch = await Branch.create({
        name: 'Test Branch',
        branchCode: 'TB1',
        displayName: 'Test Branch',
        phone: '9999999999',
        email: 'branch@test.local',
        settings: {
          workingDays: [0, 1, 2, 3, 4, 5, 6],
          weeklySchedule: [],
          lunchBreak: { enabled: false },
          timeSlotDurationMinutes: 15,
          appointmentBufferMinutes: 0,
          holidayCalendar: [],
        },
      });

      doctor = await Doctor.create({
        userId: oid(),
        doctorCode: 'DOC1',
        licenseNumber: 'LIC1',
        registrationNumber: 'REG1',
      });

      patients = await Promise.all(
        [1, 2, 3, 4, 5].map((n) =>
          Patient.create({
            mrn: `MRN${n}`,
            firstName: 'Test',
            lastName: `Patient${n}`,
            gender: 'MALE',
            mobile: `900000000${n}`,
            primaryBranchId: branch._id,
          })
        )
      );
    });

    beforeEach(async () => {
      await Appointment.deleteMany({});
    });

    it('a single-grid-slot booking still works when the service has no configured duration', async () => {
      const service = await makeService(null);
      await makeSchedule();
      const created = await appointmentService.create(bookingFor(service, 0, '10:00', '10:15'));
      expect(created.duration).toBe(15);
    });

    it('allows any grid-valid length when the service has no configured duration', async () => {
      const service = await makeService(null);
      await makeSchedule();
      const created = await appointmentService.create(bookingFor(service, 0, '10:00', '10:45'));
      expect(created.duration).toBe(45);
    });

    it('makes a 30-minute service bookable on a 15-minute grid (contiguous slot span)', async () => {
      const service = await makeService(30);
      await makeSchedule();
      const validation = await availabilityService.validateSlot(doctor._id, {
        date,
        startTime: '10:00',
        endTime: '10:30',
        branchId: branch._id,
      });
      expect(validation.valid).toBe(true);
      expect(validation.span).toHaveLength(2);

      const created = await appointmentService.create(bookingFor(service, 0, '10:00', '10:30'));
      expect(created.duration).toBe(30);
    });

    it('rejects a booking whose length contradicts the configured service duration', async () => {
      const service = await makeService(30);
      await makeSchedule();
      await expect(
        appointmentService.create(bookingFor(service, 0, '10:00', '10:15'))
      ).rejects.toMatchObject({ code: 'SERVICE_DURATION_MISMATCH' });
    });

    it('names the configured duration in the mismatch error', async () => {
      const service = await makeService(30);
      await makeSchedule();
      await expect(
        appointmentService.create(bookingFor(service, 0, '10:00', '10:45'))
      ).rejects.toThrow(/configured to take 30 minutes but this appointment is 45 minutes/);
    });

    it('does not accept a span that is not contiguous on the grid', async () => {
      await makeSchedule({ bufferTime: 5 });
      const validation = await availabilityService.validateSlot(doctor._id, {
        date,
        startTime: '10:00',
        endTime: '10:30',
        branchId: branch._id,
      });
      expect(validation.valid).toBe(false);
      expect(validation.reason).toBe('SLOT_NOT_AVAILABLE');
    });

    it('imposes no daily cap when maximumAppointments is 0', async () => {
      const service = await makeService(null);
      await makeSchedule({ maximumAppointments: 0 });
      await appointmentService.create(bookingFor(service, 0, '10:00', '10:15'));
      await appointmentService.create(bookingFor(service, 1, '10:15', '10:30'));
      await appointmentService.create(bookingFor(service, 2, '10:30', '10:45'));
      expect(await Appointment.countDocuments({})).toBe(3);
    });

    it('rejects the booking that would exceed maximumAppointments', async () => {
      const service = await makeService(null);
      await makeSchedule({ maximumAppointments: 2 });
      await appointmentService.create(bookingFor(service, 0, '10:00', '10:15'));
      await appointmentService.create(bookingFor(service, 1, '10:15', '10:30'));

      await expect(
        appointmentService.create(bookingFor(service, 2, '10:30', '10:45'))
      ).rejects.toMatchObject({ code: 'DOCTOR_DAILY_LIMIT_REACHED' });
      expect(await Appointment.countDocuments({})).toBe(2);
    });

    it('does not count cancelled or no-show appointments against the daily cap', async () => {
      const service = await makeService(null);
      await makeSchedule({ maximumAppointments: 2 });
      const first = await appointmentService.create(bookingFor(service, 0, '10:00', '10:15'));
      await appointmentService.create(bookingFor(service, 1, '10:15', '10:30'));

      await Appointment.updateOne(
        { _id: first.id },
        { status: APPOINTMENT_STATUS.CANCELLED }
      );

      await expect(
        appointmentService.create(bookingFor(service, 2, '10:30', '10:45'))
      ).resolves.toBeTruthy();
    });

    it('names the cap in the daily-limit error', async () => {
      const service = await makeService(null);
      await makeSchedule({ maximumAppointments: 1 });
      await appointmentService.create(bookingFor(service, 0, '10:00', '10:15'));
      await expect(
        appointmentService.create(bookingFor(service, 1, '10:15', '10:30'))
      ).rejects.toThrow(/maximum of 1 appointments per day.*maximumAppointments/s);
    });
  });
});
