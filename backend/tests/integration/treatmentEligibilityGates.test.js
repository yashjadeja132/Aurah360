import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import '../../src/models/index.js';
import TreatmentPlan from '../../src/models/TreatmentPlan.model.js';
import TreatmentSession from '../../src/models/TreatmentSession.model.js';
import TreatmentProtocol from '../../src/models/TreatmentProtocol.model.js';
import Patient from '../../src/models/Patient.model.js';
import TreatmentSessionService from '../../src/services/TreatmentSessionService.js';
import { HARD_STOP_TYPE, PREFLIGHT_GATE } from '../../src/enums/treatmentSession.js';

/**
 * TRT-006 — protocol eligibility + package validity were "configuration that enforces nothing":
 * TreatmentProtocol.contraindicationQuestions / ageRestrictionMin / ageRestrictionMax and
 * TreatmentPackage.validityDays were modelled, validated, persisted and rendered in the admin UI
 * while NO code path read them. A clinic that configured "not for under-18s" was told a safety
 * control existed that blocked nothing.
 *
 * These tests assert the non-blocking cases exactly as hard as the blocking ones — a gate that
 * blocks everything is an outage, and technicians learn to override an always-red gate by reflex.
 */
describe('TRT-006 eligibility gates: contraindications, age limits, package validity', () => {
  const service = new TreatmentSessionService();
  const doctorId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();

  let seq = 0;
  let plainProtocol; // no questions, no age limits
  let screeningProtocol; // two contraindication questions
  let adultProtocol; // 18..65
  let minOnlyProtocol; // 18+
  let paramProtocol; // configured execution parameters
  let adultPatient;
  let childPatient;
  let dobLessPatient;

  const DAY = 24 * 60 * 60 * 1000;

  async function newPatient({ dateOfBirth }) {
    seq += 1;
    return Patient.create({
      mrn: `MRN-EG-${Date.now()}-${seq}`,
      firstName: 'Test',
      lastName: 'Patient',
      gender: 'FEMALE',
      mobile: `90000000${seq}`,
      primaryBranchId: branchId,
      dateOfBirth,
    });
  }

  async function newPlan({ patientId, protocolId = null, packageSnapshot = null, acceptedAt = new Date() }) {
    seq += 1;
    return TreatmentPlan.create({
      planNumber: `TP-EG-${Date.now()}-${seq}`,
      consultationId: new mongoose.Types.ObjectId(),
      patientId,
      doctorId,
      branchId,
      title: 'Eligibility gate fixture',
      status: 'ACCEPTED',
      acceptedAt,
      protocolId: protocolId || undefined,
      packageSnapshot,
    });
  }

  async function newSession(plan, protocolId, extra = {}) {
    seq += 1;
    return TreatmentSession.create({
      sessionNumber: `TS-EG-${Date.now()}-${seq}`,
      treatmentPlanId: plan._id,
      patientId: plan.patientId,
      doctorId,
      branchId,
      status: 'CHECKED_IN',
      protocolId: protocolId || undefined,
      ...extra,
    });
  }

  async function gateFor(session, key) {
    const preflight = await service.getPreflight(session._id.toString());
    return preflight.gates.find((g) => g.key === key);
  }

  beforeAll(async () => {
    await connectTestDb('trtelig');

    plainProtocol = await TreatmentProtocol.create({
      protocolCode: `PROTO-EG-PLAIN-${Date.now()}`,
      name: 'Routine facial',
      items: [{ procedureName: 'Routine facial', consentRequired: false }],
    });
    screeningProtocol = await TreatmentProtocol.create({
      protocolCode: `PROTO-EG-SCREEN-${Date.now()}`,
      name: 'Chemical peel',
      items: [{ procedureName: 'Chemical peel', consentRequired: false }],
      contraindicationQuestions: ['Is the patient pregnant?', 'Active isotretinoin use?'],
    });
    adultProtocol = await TreatmentProtocol.create({
      protocolCode: `PROTO-EG-ADULT-${Date.now()}`,
      name: 'Laser hair removal',
      items: [{ procedureName: 'Laser hair removal', consentRequired: false }],
      ageRestrictionMin: 18,
      ageRestrictionMax: 65,
    });
    minOnlyProtocol = await TreatmentProtocol.create({
      protocolCode: `PROTO-EG-MIN-${Date.now()}`,
      name: 'Botulinum toxin',
      items: [{ procedureName: 'Botulinum toxin', consentRequired: false }],
      ageRestrictionMin: 18,
    });
    paramProtocol = await TreatmentProtocol.create({
      protocolCode: `PROTO-EG-PARAM-${Date.now()}`,
      name: 'Nd:YAG',
      items: [
        {
          procedureName: 'Nd:YAG',
          consentRequired: false,
          parameters: { fluence: '14 J/cm2', pulseWidth: '20ms', spotSize: '10mm' },
        },
      ],
    });

    adultPatient = await newPatient({ dateOfBirth: new Date(Date.now() - 30 * 365.25 * DAY) });
    childPatient = await newPatient({ dateOfBirth: new Date(Date.now() - 14 * 365.25 * DAY) });
    dobLessPatient = await newPatient({ dateOfBirth: null });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  describe('contraindication screening', () => {
    it('blocks when the protocol declares questions and no screening was recorded', async () => {
      const plan = await newPlan({ patientId: adultPatient._id, protocolId: screeningProtocol._id });
      const session = await newSession(plan, screeningProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.CONTRAINDICATION);

      expect(gate.applicable).toBe(true);
      expect(gate.passed).toBe(false);
      expect(gate.hardStopType).toBe(HARD_STOP_TYPE.CONTRAINDICATION_SCREENING_MISSING);
      // The technician must be told WHICH questions are outstanding, not just "incomplete".
      expect(gate.detail).toMatch(/Is the patient pregnant\?/);
      expect(gate.questions).toEqual(expect.arrayContaining(['Is the patient pregnant?']));
    });

    it('still blocks when only some of the questions were answered', async () => {
      const plan = await newPlan({ patientId: adultPatient._id, protocolId: screeningProtocol._id });
      const session = await newSession(plan, screeningProtocol._id, {
        contraindicationScreening: {
          screenedAt: new Date(),
          answers: [{ question: 'Is the patient pregnant?', answer: false }],
        },
      });

      const gate = await gateFor(session, PREFLIGHT_GATE.CONTRAINDICATION);

      expect(gate.passed).toBe(false);
      expect(gate.hardStopType).toBe(HARD_STOP_TYPE.CONTRAINDICATION_SCREENING_MISSING);
      expect(gate.detail).toMatch(/Active isotretinoin use\?/);
    });

    it('blocks with CONTRAINDICATION when an answer says the contraindication is present', async () => {
      const plan = await newPlan({ patientId: adultPatient._id, protocolId: screeningProtocol._id });
      const session = await newSession(plan, screeningProtocol._id, {
        contraindicationScreening: {
          screenedAt: new Date(),
          answers: [
            { question: 'Is the patient pregnant?', answer: true },
            { question: 'Active isotretinoin use?', answer: false },
          ],
        },
      });

      const gate = await gateFor(session, PREFLIGHT_GATE.CONTRAINDICATION);

      expect(gate.passed).toBe(false);
      expect(gate.hardStopType).toBe(HARD_STOP_TYPE.CONTRAINDICATION);
      expect(gate.detail).toMatch(/pregnant/i);
      // A positive answer is a clinical decision, not a data gap — remediation differs.
      expect(gate.resolvedBy).toMatch(/doctor/i);
    });

    it('passes once every question is answered negative', async () => {
      const plan = await newPlan({ patientId: adultPatient._id, protocolId: screeningProtocol._id });
      const session = await newSession(plan, screeningProtocol._id, {
        contraindicationScreening: {
          screenedAt: new Date(),
          answers: [
            { question: 'Is the patient pregnant?', answer: false },
            { question: 'Active isotretinoin use?', answer: false },
          ],
        },
      });

      const gate = await gateFor(session, PREFLIGHT_GATE.CONTRAINDICATION);

      expect(gate.passed).toBe(true);
      expect(gate.hardStopType).toBeFalsy();
    });

    it('is NOT applicable when the protocol declares no contraindication questions', async () => {
      const plan = await newPlan({ patientId: adultPatient._id, protocolId: plainProtocol._id });
      const session = await newSession(plan, plainProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.CONTRAINDICATION);

      expect(gate.applicable).toBe(false);
      expect(gate.passed).toBe(true);
    });

    it('is NOT applicable when no protocol is attached at all', async () => {
      const plan = await newPlan({ patientId: adultPatient._id, protocolId: null });
      const session = await newSession(plan, null);

      const gate = await gateFor(session, PREFLIGHT_GATE.CONTRAINDICATION);

      expect(gate.applicable).toBe(false);
      expect(gate.passed).toBe(true);
    });

    it('stays overridable so a data gap is not an unbreakable clinical outage', async () => {
      const plan = await newPlan({ patientId: adultPatient._id, protocolId: screeningProtocol._id });
      const session = await newSession(plan, screeningProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.CONTRAINDICATION);

      expect(gate.blocking).toBe(true);
      expect(gate.overridable).toBe(true);
    });
  });

  describe('age restriction', () => {
    it('blocks a patient below the protocol minimum age', async () => {
      const plan = await newPlan({ patientId: childPatient._id, protocolId: adultProtocol._id });
      const session = await newSession(plan, adultProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.AGE_RESTRICTION);

      expect(gate.applicable).toBe(true);
      expect(gate.passed).toBe(false);
      expect(gate.hardStopType).toBe(HARD_STOP_TYPE.AGE_RESTRICTION);
      expect(gate.patientAge).toBe(14);
      expect(gate.ageRestrictionMin).toBe(18);
      expect(gate.detail).toMatch(/restricted to/i);
    });

    it('blocks a patient above the protocol maximum age', async () => {
      const senior = await newPatient({ dateOfBirth: new Date(Date.now() - 80 * 365.25 * DAY) });
      const plan = await newPlan({ patientId: senior._id, protocolId: adultProtocol._id });
      const session = await newSession(plan, adultProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.AGE_RESTRICTION);

      expect(gate.passed).toBe(false);
      expect(gate.hardStopType).toBe(HARD_STOP_TYPE.AGE_RESTRICTION);
      expect(gate.ageRestrictionMax).toBe(65);
    });

    it('passes a patient inside the window', async () => {
      const plan = await newPlan({ patientId: adultPatient._id, protocolId: adultProtocol._id });
      const session = await newSession(plan, adultProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.AGE_RESTRICTION);

      expect(gate.applicable).toBe(true);
      expect(gate.passed).toBe(true);
      expect(gate.hardStopType).toBeFalsy();
    });

    it('passes an older patient when only a minimum is declared (no invented upper bound)', async () => {
      const senior = await newPatient({ dateOfBirth: new Date(Date.now() - 72 * 365.25 * DAY) });
      const plan = await newPlan({ patientId: senior._id, protocolId: minOnlyProtocol._id });
      const session = await newSession(plan, minOnlyProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.AGE_RESTRICTION);

      expect(gate.passed).toBe(true);
      expect(gate.ageRestrictionMax).toBeNull();
    });

    it('blocks with AGE_UNKNOWN when the restriction exists but the patient has no date of birth', async () => {
      // Decision: BLOCK, not skip. Skipping would make "not for under-18s" unenforceable for
      // exactly the records where age is unverified. It is overridable, so front desk can proceed
      // on a documented reason while the DOB is collected.
      const plan = await newPlan({ patientId: dobLessPatient._id, protocolId: adultProtocol._id });
      const session = await newSession(plan, adultProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.AGE_RESTRICTION);

      expect(gate.passed).toBe(false);
      expect(gate.hardStopType).toBe(HARD_STOP_TYPE.AGE_UNKNOWN);
      expect(gate.overridable).toBe(true);
      expect(gate.resolvedBy).toMatch(/date of birth/i);
    });

    it('is NOT applicable when the protocol declares no age restriction, even with no DOB on file', async () => {
      // The missing-DOB block must be scoped to protocols that actually restrict by age.
      const plan = await newPlan({ patientId: dobLessPatient._id, protocolId: plainProtocol._id });
      const session = await newSession(plan, plainProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.AGE_RESTRICTION);

      expect(gate.applicable).toBe(false);
      expect(gate.passed).toBe(true);
    });
  });

  describe('package validity', () => {
    const snapshot = (validityDays) => ({
      packageId: new mongoose.Types.ObjectId(),
      packageName: 'Laser 8-pack',
      packagePrice: 35000,
      discount: 0,
      validityDays,
      maximumSessions: 8,
      unusedSessions: 8,
    });

    it('blocks a session when the package has passed its validity window', async () => {
      const plan = await newPlan({
        patientId: adultPatient._id,
        protocolId: plainProtocol._id,
        packageSnapshot: snapshot(90),
        acceptedAt: new Date(Date.now() - 200 * DAY),
      });
      const session = await newSession(plan, plainProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.PACKAGE_VALIDITY);

      expect(gate.applicable).toBe(true);
      expect(gate.passed).toBe(false);
      expect(gate.hardStopType).toBe(HARD_STOP_TYPE.PACKAGE_EXPIRED);
      expect(gate.detail).toMatch(/expired on/i);
      expect(new Date(gate.packageExpiresAt).getTime()).toBeLessThan(Date.now());
    });

    it('passes while the package is still inside its validity window', async () => {
      const plan = await newPlan({
        patientId: adultPatient._id,
        protocolId: plainProtocol._id,
        packageSnapshot: snapshot(90),
        acceptedAt: new Date(Date.now() - 10 * DAY),
      });
      const session = await newSession(plan, plainProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.PACKAGE_VALIDITY);

      expect(gate.applicable).toBe(true);
      expect(gate.passed).toBe(true);
      expect(gate.hardStopType).toBeFalsy();
    });

    it('is NOT applicable for a pay-per-session plan with no package', async () => {
      const plan = await newPlan({ patientId: adultPatient._id, protocolId: plainProtocol._id });
      const session = await newSession(plan, plainProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.PACKAGE_VALIDITY);

      expect(gate.applicable).toBe(false);
      expect(gate.passed).toBe(true);
    });

    it('is NOT applicable when the package carries no validity period', async () => {
      const plan = await newPlan({
        patientId: adultPatient._id,
        protocolId: plainProtocol._id,
        packageSnapshot: snapshot(null),
        acceptedAt: new Date(Date.now() - 5000 * DAY),
      });
      const session = await newSession(plan, plainProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.PACKAGE_VALIDITY);

      expect(gate.applicable).toBe(false);
      expect(gate.passed).toBe(true);
    });

    it('stays overridable so an expired package can be honoured with an audited reason', async () => {
      const plan = await newPlan({
        patientId: adultPatient._id,
        protocolId: plainProtocol._id,
        packageSnapshot: snapshot(30),
        acceptedAt: new Date(Date.now() - 60 * DAY),
      });
      const session = await newSession(plan, plainProtocol._id);

      const gate = await gateFor(session, PREFLIGHT_GATE.PACKAGE_VALIDITY);

      expect(gate.blocking).toBe(true);
      expect(gate.overridable).toBe(true);
    });
  });

  describe('protocol parameters are surfaced for execution', () => {
    it('returns the protocol-configured parameters and suggested settings in the pre-flight', async () => {
      const plan = await newPlan({ patientId: adultPatient._id, protocolId: paramProtocol._id });
      const session = await newSession(plan, paramProtocol._id);

      const preflight = await service.getPreflight(session._id.toString());

      expect(preflight.protocolParameters).toEqual([
        expect.objectContaining({
          procedureName: 'Nd:YAG',
          parameters: { fluence: '14 J/cm2', pulseWidth: '20ms', spotSize: '10mm' },
        }),
      ]);
      expect(preflight.suggestedSettings).toMatchObject({ fluence: '14 J/cm2' });
    });

    it('returns empty parameters for a protocol that configures none', async () => {
      const plan = await newPlan({ patientId: adultPatient._id, protocolId: plainProtocol._id });
      const session = await newSession(plan, plainProtocol._id);

      const preflight = await service.getPreflight(session._id.toString());

      expect(preflight.protocolParameters).toEqual([]);
      expect(preflight.suggestedSettings).toEqual({});
    });
  });
});
