import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import '../../src/models/index.js';
import Appointment from '../../src/models/Appointment.model.js';
import Patient from '../../src/models/Patient.model.js';
import TreatmentSession from '../../src/models/TreatmentSession.model.js';
import ConsultationService from '../../src/services/ConsultationService.js';
import TreatmentPlanService from '../../src/services/TreatmentPlanService.js';
import { generateSessionNumber } from '../../src/helpers/treatmentSessionNumber.helper.js';

/**
 * §5 gap-close — the Treatment plans list previously showed no session progress or package
 * balance. TreatmentPlanService#listByDoctor now aggregates TreatmentSession counts per plan
 * (sessionsCompleted/sessionsScheduled) and echoes packageSnapshot as packageBalance.
 */
describe('Treatment plan list — session progress (§5)', () => {
  const consultationService = new ConsultationService();
  const planService = new TreatmentPlanService();
  const doctorId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId().toString();
  let seq = 0;

  async function newPlan() {
    seq += 1;
    const patient = await Patient.create({
      mrn: `MRN-TPP-${Date.now()}-${seq}`,
      firstName: 'Progress',
      lastName: `Case${seq}`,
      mobile: `91000000${seq}`,
      branchId,
      primaryBranchId: branchId,
      gender: 'MALE',
    });
    const appointment = await Appointment.create({
      appointmentNumber: `APT-TPP-${Date.now()}-${seq}`,
      patientId: patient._id,
      doctorId,
      branchId,
      serviceId: new mongoose.Types.ObjectId(),
      appointmentDate: new Date(),
      startTime: '10:00',
      endTime: '10:30',
      status: 'CHECKED_IN',
    });
    const started = await consultationService.start(
      { appointmentId: appointment._id.toString() },
      actorId
    );
    const plan = await planService.create(
      {
        consultationId: started.consultation.id,
        title: 'Laser series',
        items: [{ procedureName: 'Laser', sessionCount: 3 }],
      },
      actorId
    );
    return { planId: plan.id, patientId: patient._id };
  }

  async function addSession(planId, patientId, status) {
    seq += 1;
    return TreatmentSession.create({
      sessionNumber: await generateSessionNumber(),
      treatmentPlanId: planId,
      patientId,
      doctorId,
      branchId,
      status,
    });
  }

  beforeAll(async () => {
    await connectTestDb('planprogress');
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  it('reports sessionsCompleted / sessionsScheduled from actual TreatmentSession docs', async () => {
    const { planId, patientId } = await newPlan();
    await addSession(planId, patientId, 'COMPLETED');
    await addSession(planId, patientId, 'COMPLETED');
    await addSession(planId, patientId, 'SCHEDULED');

    const plans = await planService.listByDoctor(doctorId.toString());
    const row = plans.find((p) => p.id === planId);

    expect(row).toBeTruthy();
    expect(row.sessionsCompleted).toBe(2);
    expect(row.sessionsScheduled).toBe(3);
  });

  it('reports zero progress for a plan with no sessions yet, without throwing', async () => {
    const { planId } = await newPlan();

    const plans = await planService.listByDoctor(doctorId.toString());
    const row = plans.find((p) => p.id === planId);

    expect(row).toBeTruthy();
    expect(row.sessionsCompleted).toBe(0);
    expect(row.sessionsScheduled).toBe(0);
  });
});
