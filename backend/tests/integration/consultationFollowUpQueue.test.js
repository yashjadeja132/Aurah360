import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import '../../src/models/index.js';
import Appointment from '../../src/models/Appointment.model.js';
import Patient from '../../src/models/Patient.model.js';
import ConsultationService from '../../src/services/ConsultationService.js';

/**
 * §3.6 / §5 gap-close — a follow-up order now carries priority + a minimal reminder plan
 * (reminderDate/reminderNote), and a doctor-scoped cross-patient "Follow-ups" worklist
 * (GET /consultations/follow-ups) surfaces due/overdue ones. This exercises both: saving the
 * new fields via updateMeta, and the queue query picking them up with the right due/overdue
 * classification and doctor scoping.
 */
describe('Consultation follow-up queue (§3.6 / §5)', () => {
  const service = new ConsultationService();
  const doctorId = new mongoose.Types.ObjectId();
  const otherDoctorId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId().toString();
  let seq = 0;

  async function startedConsultation(doctor = doctorId) {
    seq += 1;
    const patient = await Patient.create({
      mrn: `MRN-FU-${Date.now()}-${seq}`,
      firstName: 'Follow',
      lastName: `Up${seq}`,
      mobile: `90000000${seq}`,
      branchId,
      primaryBranchId: branchId,
      gender: 'FEMALE',
    });
    const appointment = await Appointment.create({
      appointmentNumber: `APT-FU-${Date.now()}-${seq}`,
      patientId: patient._id,
      doctorId: doctor,
      branchId,
      serviceId: new mongoose.Types.ObjectId(),
      appointmentDate: new Date(),
      startTime: '10:00',
      endTime: '10:30',
      status: 'CHECKED_IN',
    });
    const started = await service.start({ appointmentId: appointment._id.toString() }, actorId);
    return started.consultation.id;
  }

  beforeAll(async () => {
    await connectTestDb('followupqueue');
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  it('saves priority, preferred doctor/branch, and reminder fields on the follow-up', async () => {
    const consultationId = await startedConsultation();
    const updated = await service.updateMeta(
      consultationId,
      {
        followUp: {
          value: 2,
          unit: 'WEEKS',
          reason: 'Post-procedure review',
          priority: 'HIGH',
          preferredDoctorId: doctorId.toString(),
          preferredBranchId: branchId.toString(),
          reminderDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          reminderNote: 'Call patient to confirm',
        },
      },
      actorId
    );

    expect(updated.consultation.followUp.priority).toBe('HIGH');
    expect(updated.consultation.followUp.reminderNote).toBe('Call patient to confirm');
    expect(updated.consultation.followUp.status).toBe('PENDING');
  });

  it('lists an overdue follow-up in the due/overdue queue, scoped to the right doctor', async () => {
    const consultationId = await startedConsultation();
    await service.updateMeta(
      consultationId,
      {
        followUp: {
          reason: 'Overdue check',
          priority: 'URGENT',
          reminderDate: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        },
      },
      actorId
    );

    const result = await service.listFollowUpQueue({ doctorId: doctorId.toString() });
    const row = result.items.find((i) => i.consultationId === consultationId);
    expect(row).toBeTruthy();
    expect(row.overdue).toBe(true);
    expect(row.priority).toBe('URGENT');
    expect(row.status).toBe('PENDING');

    const otherScope = await service.listFollowUpQueue({ doctorId: otherDoctorId.toString() });
    expect(otherScope.items.some((i) => i.consultationId === consultationId)).toBe(false);
  });

  it('marking a follow-up DONE removes it from the default due/overdue scope', async () => {
    const consultationId = await startedConsultation();
    await service.updateMeta(
      consultationId,
      { followUp: { reason: 'To be resolved', reminderDate: new Date(Date.now() - 1000).toISOString() } },
      actorId
    );

    let result = await service.listFollowUpQueue({ doctorId: doctorId.toString() });
    expect(result.items.some((i) => i.consultationId === consultationId)).toBe(true);

    await service.updateFollowUpStatus(consultationId, { status: 'DONE' }, actorId);

    result = await service.listFollowUpQueue({ doctorId: doctorId.toString() });
    expect(result.items.some((i) => i.consultationId === consultationId)).toBe(false);
  });
});
