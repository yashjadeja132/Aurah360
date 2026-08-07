/**
 * Module 12 seed — 50 treatment sessions, technicians, ongoing/completed progress.
 * Does not mutate Billing or Treatment Plan documents.
 */
import User from '../models/User.model.js';
import Role from '../models/Role.model.js';
import TreatmentPlan from '../models/TreatmentPlan.model.js';
import Invoice from '../models/Invoice.model.js';
import TreatmentSession from '../models/TreatmentSession.model.js';
import TreatmentSessionLog from '../models/TreatmentSessionLog.model.js';
import { generateSessionNumber } from '../helpers/treatmentSessionNumber.helper.js';
import { TREATMENT_SESSION_STATUS } from '../enums/treatmentSession.js';
import { TREATMENT_PLAN_STATUS } from '../enums/treatmentPlan.js';
import { PAYMENT_STATUS } from '../enums/billing.js';
import { ROLES } from '../constants/roles.js';
import { USER_STATUS } from '../enums/userStatus.js';
import { hashPassword } from '../helpers/crypto.helper.js';
import logger from '../libs/logger.js';

export async function seedModule12() {
  const techRole = await Role.findOne({ key: ROLES.TECHNICIAN }).exec();
  const techs = [];
  if (techRole) {
    for (const [i, email] of [
      'tech1@aurah360.local',
      'tech2@aurah360.local',
    ].entries()) {
      let user = await User.findOne({ email }).exec();
      if (!user) {
        user = await User.create({
          email,
          passwordHash: await hashPassword('ChangeMe@12345'),
          firstName: i === 0 ? 'Neha' : 'Rohit',
          lastName: i === 0 ? 'Shah' : 'Mehta',
          employeeId: i === 0 ? 'EMP-TECH-001' : 'EMP-TECH-002',
          roleId: techRole._id,
          role: ROLES.TECHNICIAN,
          status: USER_STATUS.ACTIVE,
          isActive: true,
        });
        logger.info('Module 12 technician seeded', { email });
      } else if (!user.employeeId) {
        user.employeeId = i === 0 ? 'EMP-TECH-001' : 'EMP-TECH-002';
        await user.save();
      }
      techs.push(user);
    }
  } else {
    logger.warn('Module 12 — TECHNICIAN role missing, sessions will have null technician');
  }

  // Ensure some accepted plans exist with paid/partial invoices
  const acceptedPlans = await TreatmentPlan.find({
    deletedAt: null,
    status: TREATMENT_PLAN_STATUS.ACCEPTED,
  })
    .limit(10)
    .exec();

  // Promote a few approved plans to accepted for seed if needed (only if none accepted)
  let plans = acceptedPlans;
  if (plans.length < 3) {
    const candidates = await TreatmentPlan.find({
      deletedAt: null,
      status: {
        $in: [
          TREATMENT_PLAN_STATUS.APPROVED,
          TREATMENT_PLAN_STATUS.RECOMMENDED,
          TREATMENT_PLAN_STATUS.ACCEPTED,
        ],
      },
    })
      .limit(5)
      .exec();
    for (const p of candidates) {
      if (p.status !== TREATMENT_PLAN_STATUS.ACCEPTED) {
        // Seed-only status bump so sessions can be created; runtime API never does this from sessions
        p.status = TREATMENT_PLAN_STATUS.ACCEPTED;
        p.acceptedAt = p.acceptedAt || new Date();
        await p.save();
      }
    }
    plans = await TreatmentPlan.find({
      deletedAt: null,
      status: TREATMENT_PLAN_STATUS.ACCEPTED,
    })
      .limit(10)
      .exec();
  }

  if (!plans.length) {
    logger.warn('Module 12 sessions skipped — no accepted treatment plans');
    return;
  }

  // Seed-only: ensure each plan can hold enough sessions for demo data
  for (const p of plans) {
    const minSessions = Math.ceil(50 / plans.length) + 2;
    if ((p.estimatedSessions || 0) < minSessions) {
      p.estimatedSessions = minSessions;
      if (p.packageSnapshot && typeof p.packageSnapshot === 'object') {
        p.packageSnapshot = {
          ...p.packageSnapshot,
          maximumSessions: Math.max(p.packageSnapshot.maximumSessions || 0, minSessions),
        };
      }
      await p.save();
    }
  }

  // Link invoices: prefer paid/partial for each patient
  const invoices = await Invoice.find({
    deletedAt: null,
    paymentStatus: { $in: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.PARTIALLY_PAID] },
    status: 'FINALIZED',
  })
    .limit(40)
    .exec();

  const existing = await TreatmentSession.countDocuments({ deletedAt: null });
  if (existing >= 50) {
    logger.info('Module 12 sessions already seeded', { existing });
    return;
  }

  const toCreate = 50 - existing;
  for (let i = 0; i < toCreate; i += 1) {
    const plan = plans[i % plans.length];
    let invoice =
      invoices.find((inv) => String(inv.patientId) === String(plan.patientId)) ||
      invoices[i % Math.max(invoices.length, 1)];

    if (!invoice) {
      // Create a paid invoice for seed linkage without going through billing service
      invoice = await Invoice.create({
        invoiceNumber: `INV-S12-${String(i + 1).padStart(4, '0')}`,
        patientId: plan.patientId,
        branchId: plan.branchId,
        doctorId: plan.doctorId,
        treatmentPlanId: plan._id,
        status: 'FINALIZED',
        paymentStatus: i % 3 === 0 ? PAYMENT_STATUS.PARTIALLY_PAID : PAYMENT_STATUS.PAID,
        items: [
          {
            itemType: 'PACKAGE',
            description: plan.packageSnapshot?.packageName || plan.title,
            quantity: 1,
            unitPrice: plan.packageSnapshot?.packagePrice || 10000,
            discount: 0,
            tax: 0,
            total: plan.packageSnapshot?.packagePrice || 10000,
          },
        ],
        subtotal: plan.packageSnapshot?.packagePrice || 10000,
        discount: 0,
        tax: 0,
        taxPercent: 18,
        total: plan.packageSnapshot?.packagePrice || 10000,
        paidAmount: plan.packageSnapshot?.packagePrice || 10000,
        balanceAmount: 0,
        finalizedAt: new Date(),
        notes: 'Seed invoice for Module 12',
        packageSnapshot: plan.packageSnapshot || null,
      });
    }

    const bucket = i % 5;
    let status = TREATMENT_SESSION_STATUS.SCHEDULED;
    let startedAt = null;
    let completedAt = null;
    let duration = null;

    if (bucket === 0 || bucket === 1) {
      status = TREATMENT_SESSION_STATUS.COMPLETED;
      startedAt = new Date(Date.now() - (i + 2) * 86400000);
      completedAt = new Date(Date.now() - (i + 1) * 86400000);
      duration = 45;
    } else if (bucket === 2) {
      status = TREATMENT_SESSION_STATUS.IN_PROGRESS;
      startedAt = new Date();
    } else if (bucket === 3) {
      status = TREATMENT_SESSION_STATUS.CHECKED_IN;
    }

    const tech = techs[i % Math.max(techs.length, 1)] || null;
    const session = await TreatmentSession.create({
      sessionNumber: await generateSessionNumber(),
      treatmentPlanId: plan._id,
      patientId: plan.patientId,
      doctorId: plan.doctorId,
      technicianId: tech?._id || null,
      branchId: plan.branchId,
      invoiceId: invoice._id,
      protocolId: plan.protocolId || null,
      status,
      sessionIndex: (i % 6) + 1,
      scheduledDate: new Date(Date.now() + (i - 10) * 86400000),
      startedAt,
      completedAt,
      duration,
      roomId: `Room ${(i % 4) + 1}`,
      deviceId: plan.items?.[0]?.deviceRequired || 'Device-A',
      deviceUsage: {
        device: plan.items?.[0]?.deviceRequired || 'Laser',
        machine: 'Aurah Unit 1',
        laserHead: 'Head-A',
        settings: { energy: 10 + (i % 5), pulse: 'long' },
      },
      consumables: plan.items?.[0]?.consumables || ['Gel'],
      outcome: status === TREATMENT_SESSION_STATUS.COMPLETED ? 'Tolerated well' : null,
      notes: 'Seed treatment session',
      followUp: {
        nextSessionDate: new Date(Date.now() + 14 * 86400000),
        reviewDate: new Date(Date.now() + 30 * 86400000),
        notes: 'Continue protocol',
      },
    });

    if (startedAt) {
      await TreatmentSessionLog.create({
        treatmentSessionId: session._id,
        startTime: startedAt,
        endTime: completedAt,
        operatorId: tech?._id || null,
        operatorName: tech ? `${tech.firstName} ${tech.lastName}` : 'Seed Tech',
        deviceUsed: session.deviceUsage.device,
        machineSettings: session.deviceUsage.settings,
        consumables: session.consumables,
        outcome: session.outcome,
        notes: status === TREATMENT_SESSION_STATUS.COMPLETED ? 'Completed' : 'In progress',
      });
    }
  }

  logger.info('Module 12 treatment sessions seeded', { created: toCreate, technicians: techs.length });
}

export default seedModule12;
