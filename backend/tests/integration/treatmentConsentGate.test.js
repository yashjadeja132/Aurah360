import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import '../../src/models/index.js';
import TreatmentPlan from '../../src/models/TreatmentPlan.model.js';
import TreatmentSession from '../../src/models/TreatmentSession.model.js';
import TreatmentProtocol from '../../src/models/TreatmentProtocol.model.js';
import ConsentRecord from '../../src/models/ConsentRecord.model.js';
import TreatmentSessionService from '../../src/services/TreatmentSessionService.js';
import { HARD_STOP_TYPE, PREFLIGHT_GATE } from '../../src/enums/treatmentSession.js';
import { CONSENT_STATUS } from '../../src/enums/treatmentPlan.js';

/**
 * TRT-006 (P0) regression — an ABSENT consent record must not be read as "consent not required".
 *
 * The original gate used `applicable: consents.length > 0`, so a plan with NO consent record at all
 * skipped the gate entirely and the session started: the check only ever caught an *unsigned*
 * consent, never a *missing* one. That is the more dangerous of the two, because it is the state a
 * plan is in before anyone has spoken to the patient. No test covered it, which is how it survived.
 *
 * The un-blocked cases are asserted just as hard as the blocked ones: a gate that blocks everything
 * is not a working gate, it is an outage, and technicians would learn to override it by reflex.
 */
describe('TRT-006 treatment consent gate: absent vs unsigned vs signed', () => {
  const service = new TreatmentSessionService();
  const patientId = new mongoose.Types.ObjectId();
  const doctorId = new mongoose.Types.ObjectId();
  const branchId = new mongoose.Types.ObjectId();

  let consentingProtocol;
  let consentFreeProtocol;
  let seq = 0;

  async function newPlan(protocolId) {
    seq += 1;
    return TreatmentPlan.create({
      planNumber: `TP-CG-${Date.now()}-${seq}`,
      consultationId: new mongoose.Types.ObjectId(),
      patientId,
      doctorId,
      branchId,
      title: 'Consent gate fixture',
      status: 'ACCEPTED',
      protocolId: protocolId || undefined,
    });
  }

  async function newSession(plan, protocolId) {
    seq += 1;
    return TreatmentSession.create({
      sessionNumber: `TS-CG-${Date.now()}-${seq}`,
      treatmentPlanId: plan._id,
      patientId,
      doctorId,
      branchId,
      status: 'CHECKED_IN',
      protocolId: protocolId || undefined,
    });
  }

  /** Returns the CONSENT gate descriptor from a live pre-flight evaluation. */
  async function consentGateFor(session) {
    const preflight = await service.getPreflight(session._id.toString());
    return preflight.gates.find((g) => g.key === PREFLIGHT_GATE.CONSENT);
  }

  beforeAll(async () => {
    await connectTestDb('trtconsent');
    consentingProtocol = await TreatmentProtocol.create({
      protocolCode: `PROTO-CG-YES-${Date.now()}`,
      name: 'Laser resurfacing',
      procedureName: 'Laser resurfacing',
      items: [{ procedureName: 'Laser resurfacing', consentRequired: true }],
    });
    consentFreeProtocol = await TreatmentProtocol.create({
      protocolCode: `PROTO-CG-NO-${Date.now()}`,
      name: 'Routine follow-up',
      procedureName: 'Routine follow-up',
      items: [{ procedureName: 'Routine follow-up', consentRequired: false }],
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  it('blocks with CONSENT_ABSENT when the protocol requires consent and no record was ever created', async () => {
    const plan = await newPlan(consentingProtocol._id);
    const session = await newSession(plan, consentingProtocol._id);

    const gate = await consentGateFor(session);

    expect(gate.applicable).toBe(true);
    expect(gate.passed).toBe(false);
    expect(gate.hardStopType).toBe(HARD_STOP_TYPE.CONSENT_ABSENT);
    // The two failure modes need different remediation, so they must not share wording.
    expect(gate.detail).toMatch(/never been captured|nothing to sign/i);
  });

  it('blocks with CONSENT_MISSING when a record exists but is unsigned', async () => {
    const plan = await newPlan(consentingProtocol._id);
    const session = await newSession(plan, consentingProtocol._id);
    await ConsentRecord.create({
      treatmentPlanId: plan._id,
      patientId,
      consentType: 'TREATMENT',
      title: 'Treatment consent',
      status: CONSENT_STATUS.PENDING,
    });

    const gate = await consentGateFor(session);

    expect(gate.passed).toBe(false);
    expect(gate.hardStopType).toBe(HARD_STOP_TYPE.CONSENT_MISSING);
  });

  it('passes once the consent record is accepted', async () => {
    const plan = await newPlan(consentingProtocol._id);
    const session = await newSession(plan, consentingProtocol._id);
    await ConsentRecord.create({
      treatmentPlanId: plan._id,
      patientId,
      consentType: 'TREATMENT',
      title: 'Treatment consent',
      status: CONSENT_STATUS.ACCEPTED,
      signedAt: new Date(),
    });

    const gate = await consentGateFor(session);

    expect(gate.passed).toBe(true);
    expect(gate.hardStopType).toBeFalsy();
  });

  it('does not block a protocol that declares consent is not required', async () => {
    const plan = await newPlan(consentFreeProtocol._id);
    const session = await newSession(plan, consentFreeProtocol._id);

    const gate = await consentGateFor(session);

    expect(gate.passed).toBe(true);
    // Nothing to chase: no record exists and none is wanted.
    expect(gate.applicable).toBe(false);
  });

  it('fails safe to CONSENT_ABSENT when no protocol is attached at all', async () => {
    // A protocol-less plan is exactly the case where nobody has asserted the procedure is
    // consent-free. Defaulting to "not required" here would silently reopen the P0 hole.
    const plan = await newPlan(null);
    const session = await newSession(plan, null);

    const gate = await consentGateFor(session);

    expect(gate.passed).toBe(false);
    expect(gate.hardStopType).toBe(HARD_STOP_TYPE.CONSENT_ABSENT);
    expect(gate.detail).toMatch(/clinic default/i);
  });

  it('keeps the gate overridable so a hard-stop override can still start the session', async () => {
    // The gate is a stop, not a wall — TREATMENT_HARD_STOP_OVERRIDE must remain able to proceed
    // with an audited reason, or a data-entry gap becomes an unbreakable clinical outage.
    const plan = await newPlan(consentingProtocol._id);
    const session = await newSession(plan, consentingProtocol._id);

    const gate = await consentGateFor(session);

    expect(gate.overridable).toBe(true);
    expect(gate.blocking).toBe(true);
  });
});
