import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import '../../src/models/index.js';
import Patient from '../../src/models/Patient.model.js';
import Medicine from '../../src/models/Medicine.model.js';
import Consultation from '../../src/models/Consultation.model.js';
import AuditLog from '../../src/models/AuditLog.model.js';
import PrescriptionService from '../../src/services/PrescriptionService.js';
import PrescriptionSafetyService from '../../src/services/PrescriptionSafetyService.js';
import { PERMISSIONS } from '../../src/constants/permissions.js';
import { AUDIT_ACTIONS } from '../../src/enums/auditAction.js';
import { RX_SAFETY_ALERT, RX_SAFETY_STATUS } from '../../src/enums/prescription.js';

/**
 * RX-SAFETY — allergy contraindication block + audited override + interaction mechanism.
 * The over-blocking case matters most: a non-conflicting prescription must still finalize, or the
 * feature stops real prescribing.
 */
describe('Prescribing safety: allergy block, override, interaction source honesty', () => {
  const service = new PrescriptionService();
  const safetyService = new PrescriptionSafetyService();
  const doctorId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId().toString();

  const prescriber = { auth: { permissions: [PERMISSIONS.PRESCRIPTION_SAFETY_OVERRIDE] } };
  const nonPrescriber = { auth: { permissions: [PERMISSIONS.PRESCRIPTION_ALL] } };

  let allergicPatient;
  let cleanPatient;
  let penicillin;

  async function newConsultation(patientId) {
    return Consultation.create({
      consultationNumber: `CN-RXS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      appointmentId: new mongoose.Types.ObjectId(),
      patientId,
      doctorId,
      branchId,
      status: 'IN_PROGRESS',
    });
  }

  beforeAll(async () => {
    await connectTestDb('rxsafety');
    allergicPatient = await Patient.create({
      mrn: `MRN-RXS-A-${Date.now()}`,
      firstName: 'Allergic',
      lastName: 'Patient',
      gender: 'FEMALE',
      mobile: '9000000101',
      primaryBranchId: branchId,
      medical: { allergies: 'Penicillin, dust' },
    });
    cleanPatient = await Patient.create({
      mrn: `MRN-RXS-C-${Date.now()}`,
      firstName: 'Clean',
      lastName: 'Patient',
      gender: 'MALE',
      mobile: '9000000102',
      primaryBranchId: branchId,
      medical: { noKnownDrugAllergies: true, allergiesConfirmedAt: new Date() },
    });
    penicillin = await Medicine.create({
      medicineCode: `MED-RXS-${Date.now()}`,
      name: 'Penicillin V 500mg',
      genericName: 'Penicillin V Potassium',
      category: 'Antibiotic',
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  it('parses a free-text allergy field into matchable terms and keeps unmatchable text visible', () => {
    const parsed = PrescriptionSafetyService.parseAllergyText('Penicillin (rash); ibuprofen and x');
    expect(parsed.terms.map((t) => t.term)).toEqual(
      expect.arrayContaining(['Penicillin', 'ibuprofen'])
    );
    expect(parsed.unmatchableTerms).toContain('x');
    expect(PrescriptionSafetyService.parseAllergyText('NKDA').negated).toBe(true);
    expect(PrescriptionSafetyService.parseAllergyText('').terms).toEqual([]);
  });

  it('blocks finalize when a prescribed medicine matches a recorded allergy', async () => {
    const consultation = await newConsultation(allergicPatient._id);
    const rx = await service.create(
      {
        consultationId: consultation._id.toString(),
        items: [{ medicineId: penicillin._id.toString(), dosage: '1 tab', frequency: 'Twice daily' }],
      },
      actorId,
      prescriber
    );
    expect(rx.safety.status).toBe(RX_SAFETY_STATUS.BLOCKED);
    expect(rx.safety.blockingAlerts).toContain(RX_SAFETY_ALERT.ALLERGY_CONTRAINDICATION);

    await expect(service.finalize(rx.id, {}, actorId, prescriber)).rejects.toMatchObject({
      statusCode: 409,
      code: 'PRESCRIPTION_SAFETY_BLOCKED',
    });

    const blockedAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.PRESCRIPTION_SAFETY_BLOCKED,
      resourceId: rx.id,
    });
    expect(blockedAudit).toBeTruthy();
  });

  it('refuses the override to a caller without the permission, even with a reason', async () => {
    const consultation = await newConsultation(allergicPatient._id);
    const rx = await service.create(
      {
        consultationId: consultation._id.toString(),
        items: [{ medicineId: penicillin._id.toString() }],
      },
      actorId,
      nonPrescriber
    );
    await expect(
      service.finalize(
        rx.id,
        { override: { reason: 'patient tolerated it before, monitored' } },
        actorId,
        nonPrescriber
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('allows an audited override with a reason, recorded on the prescription and audit log', async () => {
    const consultation = await newConsultation(allergicPatient._id);
    const rx = await service.create(
      {
        consultationId: consultation._id.toString(),
        items: [{ medicineId: penicillin._id.toString() }],
      },
      actorId,
      prescriber
    );
    const finalized = await service.finalize(
      rx.id,
      { override: { reason: 'Documented tolerance, will observe for 30 minutes' } },
      actorId,
      prescriber
    );
    expect(finalized.status).toBe('FINALIZED');
    expect(finalized.safetyOverrides).toHaveLength(1);
    expect(finalized.safetyOverrides[0]).toMatchObject({
      type: RX_SAFETY_ALERT.ALLERGY_CONTRAINDICATION,
      reason: 'Documented tolerance, will observe for 30 minutes',
    });

    const overrideAudit = await AuditLog.findOne({
      action: AUDIT_ACTIONS.PRESCRIPTION_SAFETY_OVERRIDDEN,
      resourceId: rx.id,
    });
    expect(overrideAudit).toBeTruthy();
    expect(overrideAudit.metadata.reason).toBe(
      'Documented tolerance, will observe for 30 minutes'
    );
  });

  it('does NOT over-block: a non-conflicting prescription still finalizes normally', async () => {
    const consultation = await newConsultation(cleanPatient._id);
    const rx = await service.create(
      {
        consultationId: consultation._id.toString(),
        items: [{ medicineName: 'Cetirizine 10mg', dosage: '1 tab', frequency: 'Once daily' }],
      },
      actorId,
      prescriber
    );
    expect(rx.safety.blockingAlerts).toEqual([]);
    const finalized = await service.finalize(rx.id, {}, actorId, prescriber);
    expect(finalized.status).toBe('FINALIZED');
    expect(finalized.safetyOverrides).toEqual([]);
  });

  it('does not block a same-class-but-different-drug prescription (documented limit, not a catch)', async () => {
    const consultation = await newConsultation(allergicPatient._id);
    const rx = await service.create(
      {
        consultationId: consultation._id.toString(),
        items: [{ medicineName: 'Amoxicillin 250mg' }],
      },
      actorId,
      prescriber
    );
    // Cross-reactivity is NOT detectable with this data model — asserted so the limit is explicit.
    expect(rx.safety.blockingAlerts).toEqual([]);
  });

  it('reports honestly that no interaction source is configured (empty !== all clear)', async () => {
    const consultation = await newConsultation(cleanPatient._id);
    const rx = await service.create(
      {
        consultationId: consultation._id.toString(),
        items: [{ medicineName: 'Paracetamol 500mg' }],
      },
      actorId,
      prescriber
    );
    expect(rx.safety.interaction.configured).toBe(false);
    expect(rx.safety.interaction.checked).toBe(false);
    expect(rx.safety.interaction.ruleCount).toBe(0);
    expect(rx.safety.alerts.map((a) => a.type)).toContain(
      RX_SAFETY_ALERT.INTERACTION_SOURCE_NOT_CONFIGURED
    );
  });

  it('blocks on an admin-maintained interaction rule once one exists, and overrides with audit', async () => {
    await safetyService.createInteractionRule(
      {
        termA: 'testdruga',
        termB: 'testdrugb',
        severity: 'MAJOR',
        blocking: true,
        clinicalEffect: 'Synthetic pair used only to prove the mechanism',
        sourceReference: 'TEST FIXTURE — not clinical guidance',
      },
      actorId
    );

    const consultation = await newConsultation(cleanPatient._id);
    const rx = await service.create(
      {
        consultationId: consultation._id.toString(),
        items: [{ medicineName: 'Testdruga 10mg' }, { medicineName: 'Testdrugb 20mg' }],
      },
      actorId,
      prescriber
    );
    expect(rx.safety.interaction.configured).toBe(true);
    expect(rx.safety.blockingAlerts).toContain(RX_SAFETY_ALERT.DRUG_INTERACTION);

    await expect(service.finalize(rx.id, {}, actorId, prescriber)).rejects.toMatchObject({
      statusCode: 409,
    });

    const finalized = await service.finalize(
      rx.id,
      { override: { reason: 'Mechanism test — interaction accepted with monitoring' } },
      actorId,
      prescriber
    );
    expect(finalized.status).toBe('FINALIZED');
    expect(finalized.safetyOverrides[0].type).toBe(RX_SAFETY_ALERT.DRUG_INTERACTION);
  });

  it('flags an unconfirmed allergy history instead of implying "no allergies"', async () => {
    const silent = await Patient.create({
      mrn: `MRN-RXS-S-${Date.now()}`,
      firstName: 'Never',
      lastName: 'Asked',
      gender: 'MALE',
      mobile: '9000000103',
      primaryBranchId: branchId,
    });
    const evaluation = await safetyService.evaluate({
      patientId: silent._id,
      items: [{ medicineName: 'Paracetamol 500mg' }],
      req: prescriber,
    });
    expect(evaluation.allergy.historyStatus).toBe('NOT_ASKED');
    expect(evaluation.alerts.map((a) => a.type)).toContain(
      RX_SAFETY_ALERT.ALLERGY_HISTORY_NOT_CONFIRMED
    );
    expect(evaluation.canFinalize).toBe(true); // advisory, not a block — documented decision
  });
});
