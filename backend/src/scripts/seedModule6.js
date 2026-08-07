/**
 * Module 6 seed — 50 sample appointments across doctors, patients, statuses.
 */
import Branch from '../models/Branch.model.js';
import Doctor from '../models/Doctor.model.js';
import Patient from '../models/Patient.model.js';
import Master from '../models/Master.model.js';
import Appointment from '../models/Appointment.model.js';
import Sequence from '../models/Sequence.model.js';
import { MASTER_TYPES } from '../constants/masterTypes.js';
import { APPOINTMENT_STATUS, APPOINTMENT_TYPE, APPOINTMENT_SOURCE } from '../enums/appointment.js';
import { generateAppointmentNumber } from '../helpers/appointmentNumber.helper.js';
import DoctorAvailabilityService from '../services/DoctorAvailabilityService.js';
import logger from '../libs/logger.js';

const STATUSES = [
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.CHECKED_IN,
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.CANCELLED,
  APPOINTMENT_STATUS.NO_SHOW,
  APPOINTMENT_STATUS.SCHEDULED,
  APPOINTMENT_STATUS.CONFIRMED,
  APPOINTMENT_STATUS.COMPLETED,
  APPOINTMENT_STATUS.SCHEDULED,
];

const TYPES = [
  APPOINTMENT_TYPE.CONSULTATION,
  APPOINTMENT_TYPE.FOLLOW_UP,
  APPOINTMENT_TYPE.PROCEDURE,
  APPOINTMENT_TYPE.TREATMENT,
];

const SOURCES = [
  APPOINTMENT_SOURCE.WALK_IN,
  APPOINTMENT_SOURCE.PHONE,
  APPOINTMENT_SOURCE.ONLINE,
  APPOINTMENT_SOURCE.APP,
];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function nextWorkingDay(from, offsetDays) {
  const d = startOfDay(from);
  d.setDate(d.getDate() + offsetDays);
  while (d.getDay() === 0) d.setDate(d.getDate() + 1); // skip Sunday
  return d;
}

export async function seedModule6() {
  const existing = await Appointment.countDocuments({ deletedAt: null });
  if (existing >= 50) {
    logger.info('Module 6 appointments already seeded', { existing });
    return;
  }

  const branches = await Branch.find({ deletedAt: null, isActive: true }).exec();
  const doctors = await Doctor.find({ deletedAt: null, isActive: true }).exec();
  const patients = await Patient.find({ deletedAt: null, isActive: true }).limit(30).exec();
  const services = await Master.find({
    type: MASTER_TYPES.SERVICE,
    deletedAt: null,
    isActive: true,
  }).exec();
  const departments = await Master.find({
    type: MASTER_TYPES.DEPARTMENT,
    deletedAt: null,
    isActive: true,
  }).exec();

  if (!branches.length || !doctors.length || !patients.length || !services.length) {
    throw new Error('Module 6 seed requires branches, doctors, patients, and services');
  }

  const seq = await Sequence.findOne({ key: 'appointment_number' });
  if (!seq || seq.value < existing) {
    await Sequence.findOneAndUpdate(
      { key: 'appointment_number' },
      { $set: { value: existing } },
      { upsert: true }
    );
  }

  const availability = new DoctorAvailabilityService();
  let created = 0;
  const target = 50 - existing;
  let dayOffset = 1;

  while (created < target && dayOffset < 60) {
    const date = nextWorkingDay(new Date(), dayOffset);
    dayOffset += 1;

    for (const doctor of doctors) {
      if (created >= target) break;
      const branchId = doctor.branches?.[0] || branches[0]._id;
      const result = await availability.getAvailableSlots(doctor._id, date, branchId);
      if (!result.available || !result.slots?.length) continue;

      for (const slot of result.slots.slice(0, 4)) {
        if (created >= target) break;
        const patient = patients[created % patients.length];
        const service = services[created % services.length];
        const department = departments.length
          ? departments[created % departments.length]
          : null;
        const status = STATUSES[created % STATUSES.length];

        // Avoid double-booking in seed for active statuses on same slot
        const clash = await Appointment.findOne({
          doctorId: doctor._id,
          deletedAt: null,
          appointmentDate: {
            $gte: startOfDay(date),
            $lte: new Date(startOfDay(date).getTime() + 86400000 - 1),
          },
          startTime: slot.start,
          status: {
            $in: [
              APPOINTMENT_STATUS.SCHEDULED,
              APPOINTMENT_STATUS.CONFIRMED,
              APPOINTMENT_STATUS.CHECKED_IN,
              APPOINTMENT_STATUS.IN_CONSULTATION,
              APPOINTMENT_STATUS.TREATMENT,
            ],
          },
        });
        if (clash && ![APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW, APPOINTMENT_STATUS.COMPLETED].includes(status)) {
          continue;
        }

        await Appointment.create({
          appointmentNumber: await generateAppointmentNumber(),
          patientId: patient._id,
          doctorId: doctor._id,
          branchId,
          departmentId: department?._id || null,
          serviceId: service._id,
          appointmentDate: startOfDay(date),
          startTime: slot.start,
          endTime: slot.end,
          duration: 15,
          status,
          appointmentType: TYPES[created % TYPES.length],
          source: SOURCES[created % SOURCES.length],
          priority: created % 7 === 0 ? 'HIGH' : 'NORMAL',
          reasonForVisit: 'Seeded visit',
          notes: `Seed appointment #${created + 1}`,
          resourceAllocation: { doctorId: doctor._id },
          completedAt: status === APPOINTMENT_STATUS.COMPLETED ? new Date() : null,
          cancelledAt: status === APPOINTMENT_STATUS.CANCELLED ? new Date() : null,
          cancellationReason:
            status === APPOINTMENT_STATUS.CANCELLED ? 'Seeded cancellation' : null,
        });
        created += 1;
      }
    }
  }

  logger.info('Module 6 appointments seeded', { created, total: existing + created });
}

export default seedModule6;
