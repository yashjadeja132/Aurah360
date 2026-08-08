import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import '../../src/config/env.js';
import { connectTestDb, dropTestDb, disconnectTestDb } from './setup.js';

import config from '../../src/config/index.js';
import AiGatewayService from '../../src/services/ai/AiGatewayService.js';
import AiRun from '../../src/models/AiRun.model.js';
import AuditLog from '../../src/models/AuditLog.model.js';
import { AI_USE_CASE, AI_RUN_STATUS } from '../../src/enums/ai.js';

import Branch from '../../src/models/Branch.model.js';
import Patient from '../../src/models/Patient.model.js';
import PatientService from '../../src/services/PatientService.js';
import PatientPortalService from '../../src/services/PatientPortalService.js';

import LoyaltyCampaign from '../../src/models/LoyaltyCampaign.model.js';
import LoyaltyEarningEngineService from '../../src/services/LoyaltyEarningEngineService.js';
import { LOYALTY_CAMPAIGN_STATUS, LOYALTY_ROUNDING_RULE } from '../../src/enums/loyalty.js';

/**
 * "Configuration that enforces nothing" — six fields that were modelled, stored, surfaced and
 * read by NO code path, each implying a control that did not exist. Every test below fails if
 * its fix is reverted; that is the point of the file.
 */
describe('configuration that must actually enforce something', () => {
  const actorId = new mongoose.Types.ObjectId();
  let branch;

  /**
   * Pin the AI layer to the deterministic MOCK provider. The dev environment carries a real
   * (credit-less) ANTHROPIC key, so leaving it in place would make these tests assert against a
   * live billing account and fail as PROVIDER_ERROR — testing the provider, not our gateway.
   */
  let aiConfigBackup;
  beforeAll(async () => {
    await connectTestDb('deadcfg');
    aiConfigBackup = { ...config.ai };
    config.ai.provider = 'MOCK';
    config.ai.anthropicApiKey = '';
    config.ai.apiKey = '';
    config.ai.apiBaseUrl = '';
  });

  afterAll(async () => {
    Object.assign(config.ai, aiConfigBackup);
    await dropTestDb();
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await Promise.all([
      AiRun.deleteMany({}),
      AuditLog.deleteMany({}),
      Patient.deleteMany({}),
      LoyaltyCampaign.deleteMany({}),
    ]);
    branch =
      (await Branch.findOne({ branchCode: 'DCFG' })) ||
      (await Branch.create({
        name: 'Dead Config Branch',
        displayName: 'Dead Config Branch',
        branchCode: 'DCFG',
        email: 'dcfg@deadcfg.test',
        phone: '9000000001',
      }));
  });

  // ─── 1 & 2. AI run provenance: prompt version and token cost ──────────────
  describe('AiRun provenance (promptVersion, usage, estimatedCostUsd)', () => {
    it('records the prompt that was actually used, not a schema default of v1', async () => {
      const gateway = new AiGatewayService();
      const res = await gateway.run(
        { useCase: AI_USE_CASE.SUGGESTED_QUESTIONS, context: { chiefComplaint: 'itchy scalp' } },
        actorId
      );

      const run = await AiRun.findById(res.runId).lean();
      expect(run.status).toBe(AI_RUN_STATUS.SUCCESS);
      expect(run.promptVersion).toBeTruthy();
      // `<label>@<content hash>` — the hash is what makes this real provenance rather than a
      // hand-maintained string that nobody bumps when the prompt text changes.
      expect(run.promptVersion).toMatch(/^suggested_questions-v1@[0-9a-f]{8}$/);
      expect(run.promptVersion).not.toBe('v1');
    });

    it('gives different use cases different prompt versions', async () => {
      const gateway = new AiGatewayService();
      const a = await gateway.run({ useCase: AI_USE_CASE.SUGGESTED_QUESTIONS, context: {} }, actorId);
      const b = await gateway.run({ useCase: AI_USE_CASE.CLINICAL_COPILOT, context: {} }, actorId);

      const [runA, runB] = await Promise.all([
        AiRun.findById(a.runId).lean(),
        AiRun.findById(b.runId).lean(),
      ]);
      expect(runA.promptVersion).not.toBe(runB.promptVersion);
      expect(runB.promptVersion).toMatch(/^clinical-copilot-v1@[0-9a-f]{8}$/);
    });

    it('records real token counts on the run', async () => {
      const gateway = new AiGatewayService();
      const res = await gateway.run(
        { useCase: AI_USE_CASE.SUGGESTED_QUESTIONS, context: { chiefComplaint: 'hair fall for 3 months' } },
        actorId
      );

      const run = await AiRun.findById(res.runId).lean();
      expect(run.usage.inputTokens).toBeGreaterThan(0);
      expect(run.usage.outputTokens).toBeGreaterThan(0);
      // MOCK genuinely costs nothing, so a zero here is the truth, not the old missing-write bug.
      expect(run.estimatedCostUsd).toBe(0);
    });

    it('does not fabricate a prompt version for a run where no prompt was sent', async () => {
      const gateway = new AiGatewayService();
      const previous = config.ai.enabled;
      config.ai.enabled = false;
      try {
        const res = await gateway.run({ useCase: AI_USE_CASE.SUGGESTED_QUESTIONS, context: {} }, actorId);
        const run = await AiRun.findById(res.runId).lean();
        expect(run.status).toBe(AI_RUN_STATUS.KILL_SWITCH);
        expect(run.promptVersion ?? null).toBeNull();
      } finally {
        config.ai.enabled = previous;
      }
    });

    it('governanceSummary reports month-to-date spend from the runs, not just the budget', async () => {
      const gateway = new AiGatewayService();
      await AiRun.create({
        useCase: AI_USE_CASE.SUGGESTED_QUESTIONS,
        requestedBy: actorId,
        provider: 'ANTHROPIC',
        model: 'claude-sonnet-5',
        inputManifest: {},
        status: AI_RUN_STATUS.SUCCESS,
        estimatedCostUsd: 4.25,
      });

      const summary = await gateway.governanceSummary();
      expect(summary.estimatedCostUsd).toBe(4.25);
      expect(summary.monthToDateSpendUsd).toBe(4.25);
      expect(summary.budgetExceeded).toBe(false);
    });
  });

  // ─── 3. AI_MONTHLY_BUDGET_USD enforcement ─────────────────────────────────
  describe('AI_MONTHLY_BUDGET_USD is a ceiling, not decoration', () => {
    const withBudget = async (usd, fn) => {
      const previous = config.ai.monthlyBudgetUsd;
      config.ai.monthlyBudgetUsd = usd;
      try {
        return await fn();
      } finally {
        config.ai.monthlyBudgetUsd = previous;
      }
    };

    /** Month-to-date spend already on the books. */
    const seedSpend = (usd) =>
      AiRun.create({
        useCase: AI_USE_CASE.SUGGESTED_QUESTIONS,
        requestedBy: actorId,
        provider: 'ANTHROPIC',
        model: 'claude-sonnet-5',
        inputManifest: {},
        status: AI_RUN_STATUS.SUCCESS,
        estimatedCostUsd: usd,
      });

    it('refuses the call once the month exceeds the budget, and says so', async () => {
      await seedSpend(60);
      const res = await withBudget(50, () =>
        new AiGatewayService().run(
          { useCase: AI_USE_CASE.CLINICAL_COPILOT, context: { chiefComplaint: 'acne' } },
          actorId
        )
      );

      expect(res.status).toBe(AI_RUN_STATUS.BUDGET_EXCEEDED);
      expect(res.degraded).toBe(true);
      expect(res.output).toBeNull();
      // The refusal must be VISIBLE, not a silent empty result the doctor mistakes for "no findings".
      expect(res.reason).toMatch(/budget/i);
      expect(res.reason).toContain('60.00');
      expect(res.reason).toContain('50.00');
      expect(res.budget).toEqual({ spentUsd: 60, budgetUsd: 50 });
    });

    it('degrades rather than throwing, so the clinical flow is never broken', async () => {
      await seedSpend(999);
      await expect(
        withBudget(50, () =>
          new AiGatewayService().run({ useCase: AI_USE_CASE.RED_FLAG_ASSIST, context: {} }, actorId)
        )
      ).resolves.toBeTruthy();
    });

    it('audits the refusal', async () => {
      await seedSpend(60);
      await withBudget(50, () =>
        new AiGatewayService().run({ useCase: AI_USE_CASE.SUGGESTED_QUESTIONS, context: {} }, actorId)
      );

      const audit = await AuditLog.findOne({ action: 'AI_BUDGET_EXCEEDED' }).lean();
      expect(audit).toBeTruthy();
      expect(audit.metadata.spentUsd).toBe(60);
      expect(audit.metadata.budgetUsd).toBe(50);
    });

    it('allows the call while spend is still under budget', async () => {
      await seedSpend(10);
      const res = await withBudget(50, () =>
        new AiGatewayService().run({ useCase: AI_USE_CASE.SUGGESTED_QUESTIONS, context: {} }, actorId)
      );
      expect(res.status).toBe(AI_RUN_STATUS.SUCCESS);
      expect(res.degraded).toBe(false);
    });

    it('treats a budget of 0 as unlimited — a blank env var must not switch AI off', async () => {
      await seedSpend(500);
      const res = await withBudget(0, () =>
        new AiGatewayService().run({ useCase: AI_USE_CASE.SUGGESTED_QUESTIONS, context: {} }, actorId)
      );
      expect(res.status).toBe(AI_RUN_STATUS.SUCCESS);
    });

    it('ignores spend from a previous calendar month', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1, 15);
      const old = await seedSpend(500);
      // Driver-level so mongoose's timestamp plugin cannot stamp createdAt back to now.
      await AiRun.collection.updateOne({ _id: old._id }, { $set: { createdAt: lastMonth } });

      const res = await withBudget(50, () =>
        new AiGatewayService().run({ useCase: AI_USE_CASE.SUGGESTED_QUESTIONS, context: {} }, actorId)
      );
      expect(res.status).toBe(AI_RUN_STATUS.SUCCESS);
    });
  });

  // ─── 4. Patient.guardianVerified is a PRIVACY gate ────────────────────────
  describe('guardianVerified gates dependent portal access', () => {
    const portal = new PatientPortalService();

    const makeGuardianAndDependent = async ({ verified }) => {
      const guardian = await Patient.create({
        firstName: 'Guardian',
        lastName: 'One',
        gender: 'FEMALE',
        mobile: '9811100001',
        mrn: `MRNG${Date.now()}`,
        primaryBranchId: branch._id,
      });
      const dependent = await Patient.create({
        firstName: 'Dependent',
        lastName: 'Child',
        gender: 'MALE',
        mobile: '9811100002',
        mrn: `MRND${Date.now()}`,
        primaryBranchId: branch._id,
        isDependent: true,
        guardianPatientId: guardian._id,
        guardianVerified: verified,
      });
      return { guardian, dependent };
    };

    it('REFUSES an unverified guardian the dependent clinical record', async () => {
      const { guardian, dependent } = await makeGuardianAndDependent({ verified: false });

      await expect(
        portal.dependentDashboard(guardian._id.toString(), dependent._id.toString())
      ).rejects.toMatchObject({ statusCode: 403, code: 'GUARDIAN_NOT_VERIFIED' });
    });

    it('refuses every dependent-scoped read, not only the dashboard', async () => {
      const { guardian, dependent } = await makeGuardianAndDependent({ verified: false });
      const g = guardian._id.toString();
      const d = dependent._id.toString();

      await expect(portal.dependentAppointments(g, d)).rejects.toMatchObject({ statusCode: 403 });
      await expect(portal.dependentInvoices(g, d)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('ALLOWS a verified guardian through — the gate must not lock out legitimate guardians', async () => {
      const { guardian, dependent } = await makeGuardianAndDependent({ verified: true });

      const data = await portal.dependentDashboard(guardian._id.toString(), dependent._id.toString());
      expect(data.dependent.id).toBe(dependent._id.toString());
    });

    it('still lists the dependent with its pending verification state, so the portal can explain why', async () => {
      const { guardian, dependent } = await makeGuardianAndDependent({ verified: false });
      const list = await portal.listDependents(guardian._id.toString());
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(dependent._id.toString());
      expect(list[0].guardianVerified).toBe(false);
    });

    it('is set only by the staff verification act, and cannot be self-asserted in a profile edit', async () => {
      const service = new PatientService();
      const { guardian, dependent } = await makeGuardianAndDependent({ verified: false });

      // A profile update carrying the flag must not move it.
      await service.update(dependent._id.toString(), { guardianVerified: true, firstName: 'Dependent' }, actorId);
      expect((await Patient.findById(dependent._id)).guardianVerified).toBe(false);

      // The staff act does.
      await service.setGuardianVerified(dependent._id.toString(), { verified: true }, actorId);
      expect((await Patient.findById(dependent._id)).guardianVerified).toBe(true);

      // And the previously-refused guardian now gets through.
      await expect(
        portal.dependentDashboard(guardian._id.toString(), dependent._id.toString())
      ).resolves.toBeTruthy();
    });

    it('refuses to verify a patient that has no guardian link at all', async () => {
      const service = new PatientService();
      const lone = await Patient.create({
        firstName: 'Lone',
        lastName: 'Adult',
        gender: 'MALE',
        mobile: '9811100003',
        mrn: `MRNL${Date.now()}`,
        primaryBranchId: branch._id,
      });
      await expect(
        service.setGuardianVerified(lone._id.toString(), { verified: true }, actorId)
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ─── 5. Patient.firstTouchSourceCategory is immutable after first write ───
  describe('firstTouchSourceCategory preserves the first touch', () => {
    const service = new PatientService();

    const createPatient = (overrides = {}) =>
      service.create(
        {
          firstName: 'First',
          lastName: 'Touch',
          gender: 'FEMALE',
          mobile: `98222${Math.floor(10000 + Math.random() * 89999)}`,
          primaryBranchId: branch._id.toString(),
          allowDuplicate: true,
          ...overrides,
        },
        actorId
      );

    it('is written at creation from the initial sourceCategory', async () => {
      const created = await createPatient({ sourceCategory: 'INSTAGRAM_AD' });
      const saved = await Patient.findById(created.id);
      expect(saved.firstTouchSourceCategory).toBe('INSTAGRAM_AD');
      expect(saved.sourceCategory).toBe('INSTAGRAM_AD');
    });

    it('survives a later change of sourceCategory — create, update, first touch unchanged', async () => {
      const created = await createPatient({ sourceCategory: 'INSTAGRAM_AD' });

      await service.update(created.id, { sourceCategory: 'REFERRAL' }, actorId);

      const saved = await Patient.findById(created.id);
      expect(saved.sourceCategory).toBe('REFERRAL'); // current attribution moves
      expect(saved.firstTouchSourceCategory).toBe('INSTAGRAM_AD'); // first touch does not
    });

    it('cannot be overwritten even by a payload that names it directly', async () => {
      const created = await createPatient({ sourceCategory: 'WALK_IN' });
      await service.update(
        created.id,
        { firstTouchSourceCategory: 'GOOGLE_ADS', sourceCategory: 'GOOGLE_ADS' },
        actorId
      );
      const saved = await Patient.findById(created.id);
      expect(saved.firstTouchSourceCategory).toBe('WALK_IN');
    });

    it('stays null when the patient was registered with no source at all', async () => {
      const created = await createPatient({});
      const saved = await Patient.findById(created.id);
      expect(saved.firstTouchSourceCategory).toBeNull();
    });

    it('backfills a legacy record that never had a first touch captured', async () => {
      const created = await createPatient({});
      await service.update(created.id, { sourceCategory: 'REFERRAL' }, actorId);
      const saved = await Patient.findById(created.id);
      expect(saved.firstTouchSourceCategory).toBe('REFERRAL');

      // ...and having been backfilled once, it is now immutable like any other.
      await service.update(created.id, { sourceCategory: 'WALK_IN' }, actorId);
      expect((await Patient.findById(created.id)).firstTouchSourceCategory).toBe('REFERRAL');
    });
  });

  // ─── 6. LoyaltyCampaign.audienceSegment actually targets ──────────────────
  describe('LoyaltyCampaign.audienceSegment targets the campaign', () => {
    const engine = new LoyaltyEarningEngineService();
    const version = { roundingRule: LOYALTY_ROUNDING_RULE.FLOOR };
    const rule = { ruleCode: 'SPEND_POINTS' };

    const makeCampaign = (audienceSegment) => {
      const now = new Date();
      return LoyaltyCampaign.create({
        name: 'Double points week',
        multiplier: 2,
        appliesToRuleCodes: [],
        startDate: new Date(now.getTime() - 86400000),
        endDate: new Date(now.getTime() + 86400000),
        status: LOYALTY_CAMPAIGN_STATUS.ACTIVE,
        audienceSegment,
      });
    };

    const makePatient = (tags) =>
      Patient.create({
        firstName: 'Seg',
        lastName: 'Member',
        gender: 'FEMALE',
        mobile: `97000${Math.floor(10000 + Math.random() * 89999)}`,
        mrn: `MRNS${Date.now()}${Math.floor(Math.random() * 999)}`,
        primaryBranchId: branch._id,
        tags,
      });

    it('does NOT boost a patient outside the targeted segment', async () => {
      await makeCampaign('Gold');
      const patient = await makePatient(['walk-in']);

      const res = await engine.applyCampaignMultiplierDetailed(
        rule,
        version,
        { patientId: patient._id, branchId: branch._id },
        100,
        new Date()
      );

      expect(res.points).toBe(100); // unboosted
      expect(res.campaign).toBeNull();
    });

    it('boosts a patient whose CRM tag matches the segment', async () => {
      await makeCampaign('Gold');
      const patient = await makePatient(['Gold', 'vip']);

      const res = await engine.applyCampaignMultiplierDetailed(
        rule,
        version,
        { patientId: patient._id, branchId: branch._id },
        100,
        new Date()
      );

      expect(res.points).toBe(200);
      expect(res.campaign.multiplier).toBe(2);
    });

    it('matches segment tags case-insensitively — they are typed by hand in two screens', async () => {
      await makeCampaign('  gOLD ');
      const patient = await makePatient(['Gold']);
      const res = await engine.applyCampaignMultiplierDetailed(
        rule,
        version,
        { patientId: patient._id, branchId: branch._id },
        100,
        new Date()
      );
      expect(res.points).toBe(200);
    });

    it('still applies an untargeted campaign to everyone', async () => {
      await makeCampaign(null);
      const patient = await makePatient(['walk-in']);
      const res = await engine.applyCampaignMultiplierDetailed(
        rule,
        version,
        { patientId: patient._id, branchId: branch._id },
        100,
        new Date()
      );
      expect(res.points).toBe(200);
    });

    it('fails closed when there is no patient to evaluate the segment against', async () => {
      await makeCampaign('Gold');
      const res = await engine.applyCampaignMultiplierDetailed(
        rule,
        version,
        { branchId: branch._id },
        100,
        new Date()
      );
      expect(res.points).toBe(100);
      expect(res.campaign).toBeNull();
    });
  });
});
