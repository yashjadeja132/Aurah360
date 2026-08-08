import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import '../../src/models/index.js';
import Appointment from '../../src/models/Appointment.model.js';
import Consultation from '../../src/models/Consultation.model.js';
import ConsultationService from '../../src/services/ConsultationService.js';
import { APPOINTMENT_STATUS } from '../../src/enums/appointment.js';
import { CONSULTATION_STATUS } from '../../src/enums/consultation.js';

/**
 * Signing a consultation is the clinical end of the visit. Two defects met here:
 *
 *  1. sign() never closed the appointment, so it stayed CHECKED_IN forever — the doctor's
 *     "Start from appointment" list never emptied, and the loyalty engine's VISIT_COMPLETED
 *     (which subscribes to appointment completion) never fired for a consulted patient.
 *  2. start() only reused an existing consultation while it was UNfinished. Once signed, opening
 *     the EMR again from the same appointment created a SECOND consultation — one visit silently
 *     split across two clinical records.
 *
 * (2) is the more serious of the two: (1) is a stale list, (2) is a forked medical record.
 */
describe('Consultation sign closes out the visit', () => {
  const service = new ConsultationService();
  const patientId = new mongoose.Types.ObjectId();
  const doctorId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId().toString();
  let seq = 0;

  async function newAppointment(status = APPOINTMENT_STATUS.CHECKED_IN) {
    seq += 1;
    return Appointment.create({
      appointmentNumber: `APT-SGN-${Date.now()}-${seq}`,
      patientId,
      doctorId,
      branchId,
      serviceId: new mongoose.Types.ObjectId(),
      appointmentDate: new Date(),
      startTime: '10:00',
      endTime: '10:30',
      status,
    });
  }

  beforeAll(async () => {
    await connectTestDb('signvisit');
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  it('marks the appointment COMPLETED so it leaves the "start from appointment" list', async () => {
    const appointment = await newAppointment();
    const started = await service.start({ appointmentId: appointment._id.toString() }, actorId);
    const consultationId = started.consultation.id;

    await service.sign(consultationId, actorId);

    const after = await Appointment.findById(appointment._id).exec();
    expect(after.status).toBe(APPOINTMENT_STATUS.COMPLETED);
    expect(after.completedAt).toBeTruthy();

    // The list filters on these statuses; COMPLETED must not be among them or the fix is cosmetic.
    const eligible = ['CHECKED_IN', 'IN_CONSULTATION', 'CONFIRMED', 'SCHEDULED'];
    expect(eligible).not.toContain(after.status);
  });

  it('does not create a second consultation when the EMR is reopened after signing', async () => {
    const appointment = await newAppointment();
    const appointmentId = appointment._id.toString();
    const first = await service.start({ appointmentId }, actorId);
    await service.sign(first.consultation.id, actorId);

    const reopened = await service.start({ appointmentId }, actorId);

    expect(reopened.consultation.id).toBe(first.consultation.id);
    expect(reopened.consultation.status).toBe(CONSULTATION_STATUS.SIGNED);
    const count = await Consultation.countDocuments({ appointmentId: appointment._id }).exec();
    expect(count).toBe(1);
  });

  it('still resumes an in-progress consultation rather than starting a new one', async () => {
    const appointment = await newAppointment();
    const appointmentId = appointment._id.toString();
    const first = await service.start({ appointmentId }, actorId);

    const resumed = await service.start({ appointmentId }, actorId);

    expect(resumed.consultation.id).toBe(first.consultation.id);
    expect(await Consultation.countDocuments({ appointmentId: appointment._id }).exec()).toBe(1);
  });

  it('signs successfully even when the appointment was already completed at the front desk', async () => {
    // Bookkeeping must never be able to reject a clinical signature.
    const appointment = await newAppointment();
    const started = await service.start({ appointmentId: appointment._id.toString() }, actorId);
    await Appointment.updateOne(
      { _id: appointment._id },
      { status: APPOINTMENT_STATUS.COMPLETED, completedAt: new Date() }
    ).exec();

    const signed = await service.sign(started.consultation.id, actorId);

    expect(signed.consultation.status).toBe(CONSULTATION_STATUS.SIGNED);
    const after = await Appointment.findById(appointment._id).exec();
    expect(after.status).toBe(APPOINTMENT_STATUS.COMPLETED);
  });

  it('signs successfully — and leaves the appointment alone — when it was cancelled after check-in', async () => {
    const appointment = await newAppointment();
    const started = await service.start({ appointmentId: appointment._id.toString() }, actorId);
    await Appointment.updateOne(
      { _id: appointment._id },
      { status: APPOINTMENT_STATUS.CANCELLED }
    ).exec();

    const signed = await service.sign(started.consultation.id, actorId);

    expect(signed.consultation.status).toBe(CONSULTATION_STATUS.SIGNED);
    const after = await Appointment.findById(appointment._id).exec();
    // A cancelled appointment must not be resurrected into COMPLETED by a late signature.
    expect(after.status).toBe(APPOINTMENT_STATUS.CANCELLED);
  });
});
