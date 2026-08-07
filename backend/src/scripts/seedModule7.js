/**
 * Module 7 seed — today's appointments, waiting queue, VIP, walk-in.
 */
import Branch from '../models/Branch.model.js';
import Doctor from '../models/Doctor.model.js';
import Patient from '../models/Patient.model.js';
import Master from '../models/Master.model.js';
import Appointment from '../models/Appointment.model.js';
import QueueEntry from '../models/QueueEntry.model.js';
import { MASTER_TYPES } from '../constants/masterTypes.js';
import { APPOINTMENT_STATUS, APPOINTMENT_TYPE, APPOINTMENT_SOURCE } from '../enums/appointment.js';
import { QUEUE_STATUS, QUEUE_PRIORITY, QUEUE_PRIORITY_WEIGHT } from '../enums/queue.js';
import { generateAppointmentNumber } from '../helpers/appointmentNumber.helper.js';
import { generateQueueToken } from '../helpers/queueToken.helper.js';
import DoctorAvailabilityService from '../services/DoctorAvailabilityService.js';
import logger from '../libs/logger.js';

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function seedModule7() {
  const today = startOfDay(new Date());
  const existingQueue = await QueueEntry.countDocuments({
    deletedAt: null,
    queueDate: { $gte: today, $lte: new Date(today.getTime() + 86400000 - 1) },
  });
  if (existingQueue >= 3) {
    logger.info('Module 7 queue already seeded', { existingQueue });
    return;
  }

  const branches = await Branch.find({ deletedAt: null, isActive: true }).exec();
  const doctors = await Doctor.find({ deletedAt: null, isActive: true }).limit(3).exec();
  const patients = await Patient.find({ deletedAt: null, isActive: true }).limit(10).exec();
  const services = await Master.find({
    type: MASTER_TYPES.SERVICE,
    deletedAt: null,
    isActive: true,
  }).exec();

  if (!branches.length || !doctors.length || !patients.length || !services.length) {
    throw new Error('Module 7 seed requires branches, doctors, patients, and services');
  }

  const branchId = doctors[0].branches?.[0] || branches[0]._id;
  const availability = new DoctorAvailabilityService();

  // Ensure a VIP patient exists
  let vipPatient = patients.find((p) => p.isVip) || patients[0];
  if (!vipPatient.isVip) {
    vipPatient.isVip = true;
    await vipPatient.save();
  }

  const result = await availability.getAvailableSlots(doctors[0]._id, today, branchId);
  const slots = result.slots || [];
  if (!slots.length) {
    logger.warn('Module 7 seed: no available slots today — creating appointments without slot engine');
  }

  const createdAppts = [];
  const slotPool = slots.length
    ? slots
    : [
        { start: '10:00', end: '10:15' },
        { start: '10:15', end: '10:30' },
        { start: '10:30', end: '10:45' },
        { start: '11:00', end: '11:15' },
        { start: '11:15', end: '11:30' },
      ];

  for (let i = 0; i < Math.min(5, slotPool.length); i += 1) {
    const slot = slotPool[i];
    const doctor = doctors[i % doctors.length];
    const patient = i === 0 ? vipPatient : patients[(i + 1) % patients.length];
    const isWalkIn = i === 4;
    const status =
      i < 3 ? APPOINTMENT_STATUS.CONFIRMED : APPOINTMENT_STATUS.SCHEDULED;

    const clash = await Appointment.findOne({
      doctorId: doctor._id,
      deletedAt: null,
      appointmentDate: {
        $gte: today,
        $lte: new Date(today.getTime() + 86400000 - 1),
      },
      startTime: slot.start,
      status: {
        $in: [
          APPOINTMENT_STATUS.SCHEDULED,
          APPOINTMENT_STATUS.CONFIRMED,
          APPOINTMENT_STATUS.CHECKED_IN,
          APPOINTMENT_STATUS.IN_CONSULTATION,
        ],
      },
    });
    if (clash) continue;

    const appt = await Appointment.create({
      appointmentNumber: await generateAppointmentNumber(),
      patientId: patient._id,
      doctorId: doctor._id,
      branchId: doctor.branches?.[0] || branchId,
      serviceId: services[i % services.length]._id,
      appointmentDate: today,
      startTime: slot.start,
      endTime: slot.end,
      duration: 15,
      status,
      appointmentType: APPOINTMENT_TYPE.CONSULTATION,
      source: isWalkIn ? APPOINTMENT_SOURCE.WALK_IN : APPOINTMENT_SOURCE.PHONE,
      reasonForVisit: isWalkIn ? 'Walk-in seed' : 'Module 7 reception seed',
      notes: isWalkIn ? 'Seed walk-in example' : null,
    });
    createdAppts.push({ appt, patient, doctor, isWalkIn, isVip: patient.isVip });
  }

  // Check in first 3 into waiting queue (VIP first)
  let sortOrder = 0;
  for (const row of createdAppts.slice(0, 3)) {
    sortOrder += 1;
    const priority = row.isVip ? QUEUE_PRIORITY.VIP : QUEUE_PRIORITY.NORMAL;
    const tokenNumber = await generateQueueToken(row.appt.branchId, today);

    await Appointment.updateOne(
      { _id: row.appt._id },
      { $set: { status: APPOINTMENT_STATUS.CHECKED_IN } }
    );

    await QueueEntry.create({
      tokenNumber,
      appointmentId: row.appt._id,
      patientId: row.patient._id,
      doctorId: row.doctor._id,
      branchId: row.appt.branchId,
      queueDate: today,
      queueStatus: QUEUE_STATUS.WAITING,
      priority,
      priorityWeight: QUEUE_PRIORITY_WEIGHT[priority],
      sortOrder,
      estimatedWaitTime: sortOrder * 15,
      arrivalTime: new Date(),
      isWalkIn: false,
      isLate: false,
      receptionNotes: row.isVip ? 'VIP patient — seed' : 'Seed waiting queue',
    });
  }

  // Leave walk-in appointment (if created) as example without auto queue if not in first 3
  const walkInRow = createdAppts.find((r) => r.isWalkIn);
  if (walkInRow && !createdAppts.slice(0, 3).includes(walkInRow)) {
    logger.info('Module 7 walk-in appointment ready for check-in', {
      appointmentNumber: walkInRow.appt.appointmentNumber,
    });
  }

  logger.info('Module 7 reception/queue seeded', {
    appointments: createdAppts.length,
    queueEntries: Math.min(3, createdAppts.length),
  });
}
