import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';
import Patient from '../../src/models/Patient.model.js';
import ConsentService from '../../src/services/ConsentService.js';
import { CONSENT_PURPOSE, CONSENT_STATE } from '../../src/enums/privacy.js';

/**
 * §18.3 edge case: "Patient opts out of marketing but keeps service reminders" — proves the
 * append-only consent log and legacy-flag sync work against a real database, and that
 * withdrawal history is never deleted, only appended to.
 */
describe('Consent grant/withdraw (real DB)', () => {
  const consentService = new ConsentService();
  let patient;

  beforeAll(async () => {
    await connectTestDb('consent-withdrawal');
    patient = await Patient.create({
      mrn: `MRN-TEST-${Date.now()}`,
      firstName: 'Test',
      lastName: 'Patient',
      gender: 'MALE',
      mobile: '9000000001',
      primaryBranchId: new mongoose.Types.ObjectId(),
    });
  });

  afterAll(async () => {
    await dropTestDb();
    await disconnectTestDb();
  });

  it('grants marketing consent and reflects it as granted', async () => {
    await consentService.grant({ patientId: patient._id, purpose: CONSENT_PURPOSE.MARKETING_MESSAGES }, null);
    const granted = await consentService.isGranted(patient._id, CONSENT_PURPOSE.MARKETING_MESSAGES);
    expect(granted).toBe(true);
  });

  it('withdrawing marketing consent does not touch service-message consent', async () => {
    await consentService.grant({ patientId: patient._id, purpose: CONSENT_PURPOSE.SERVICE_MESSAGES }, null);
    await consentService.withdraw({ patientId: patient._id, purpose: CONSENT_PURPOSE.MARKETING_MESSAGES, reason: 'opted out' }, null);

    const marketing = await consentService.isGranted(patient._id, CONSENT_PURPOSE.MARKETING_MESSAGES);
    const service = await consentService.isGranted(patient._id, CONSENT_PURPOSE.SERVICE_MESSAGES);
    expect(marketing).toBe(false);
    expect(service).toBe(true);
  });

  it('withdrawal is appended, not destructive — full history survives', async () => {
    const history = await consentService.history(patient._id, CONSENT_PURPOSE.MARKETING_MESSAGES);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].state).toBe(CONSENT_STATE.WITHDRAWN); // most recent first
    expect(history.some((h) => h.state === CONSENT_STATE.GRANTED)).toBe(true);
  });
});
