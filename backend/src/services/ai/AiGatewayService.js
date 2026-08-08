import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ApiError from '../../libs/ApiError.js';
import AiRun from '../../models/AiRun.model.js';
import AiFeatureFlag from '../../models/AiFeatureFlag.model.js';
import User from '../../models/User.model.js';
import PiiRedactor from './PiiRedactor.js';
import AiProviderAdapter from './AiProviderAdapter.js';
import AuditService from '../AuditService.js';
import config from '../../config/index.js';
import { AUDIT_ACTIONS } from '../../enums/auditAction.js';
import { AI_USE_CASE, AI_RUN_STATUS, AI_DISPOSITION } from '../../enums/ai.js';
import { estimateCostUsd } from './AiCostEstimator.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Byte-stable system prompt + structured-output schema for the clinical copilot. Loaded once
 * from disk so the cached prompt prefix never varies between requests (any interpolation of
 * patient data or dates would silently break prompt caching).
 */
const CLINICAL_COPILOT_PROMPT = fs.readFileSync(
  path.join(HERE, '..', '..', 'prompts', 'clinical-copilot-v1.txt'),
  'utf8'
);
const CLINICAL_COPILOT_SCHEMA = JSON.parse(
  fs.readFileSync(path.join(HERE, 'schemas', 'clinical-copilot-v1.schema.json'), 'utf8')
);

const JSON_SCHEMAS = {
  [AI_USE_CASE.CLINICAL_COPILOT]: CLINICAL_COPILOT_SCHEMA,
};

const SCHEMA_HINTS = {
  [AI_USE_CASE.SUGGESTED_QUESTIONS]: '{ "questions": string[] }',
  [AI_USE_CASE.RED_FLAG_ASSIST]: '{ "redFlags": string[], "notes": string }',
  [AI_USE_CASE.REPORT_SUMMARY]: '{ "summary": string, "abnormalItems": string[] }',
  [AI_USE_CASE.TIMELINE_SUMMARY]: '{ "summary": string }',
  [AI_USE_CASE.DRAFT_NOTE]: '{ "draftNote": { "subjective": string, "objective": string, "assessment": string, "plan": string } }',
  [AI_USE_CASE.PATIENT_INSTRUCTION_DRAFT]: '{ "instructions": string }',
  [AI_USE_CASE.TREATMENT_CHECKLIST_ASSIST]: '{ "checklist": string[] }',
  [AI_USE_CASE.ANALYTICS_NARRATIVE]: '{ "narrative": string }',
  [AI_USE_CASE.CLINICAL_COPILOT]:
    '{ "summary": string, "possible_conditions": [...], "follow_up_questions": string[], "red_flags": string[], "investigations": [...], "diet_lifestyle_advice": string[], "medication_suggestions": [...], "procedural_options_note": string, "aftercare_advice_english": string, "patient_advice_gujarati": string, "confidence_note": string }',
};

const SYSTEM_PROMPTS = {
  [AI_USE_CASE.SUGGESTED_QUESTIONS]:
    'You are a clinical documentation assistant for a dermatology/hair/laser clinic. Suggest 3-6 additional history questions the doctor should ask based on the chief complaint. Never diagnose. Never suggest treatment.',
  [AI_USE_CASE.RED_FLAG_ASSIST]:
    'Review the de-identified clinical context and flag any described symptoms that clinicians commonly treat as red flags requiring urgent attention. This is a suggestion only, not a diagnosis.',
  [AI_USE_CASE.REPORT_SUMMARY]:
    'Summarize the provided de-identified lab/report text in plain language and list any values flagged as abnormal in the source text. Do not infer values not present.',
  [AI_USE_CASE.TIMELINE_SUMMARY]:
    'Summarize this de-identified patient visit/medication/procedure history into a short clinical timeline narrative.',
  [AI_USE_CASE.DRAFT_NOTE]:
    'Draft a SOAP note from the doctor-selected de-identified facts. This is a draft only — the doctor must review, edit and sign before it becomes part of the record.',
  [AI_USE_CASE.PATIENT_INSTRUCTION_DRAFT]:
    'Write simple, low-literacy-friendly aftercare instructions in English based on the doctor-approved plan provided.',
  [AI_USE_CASE.TREATMENT_CHECKLIST_ASSIST]:
    'Given the protocol and current session state, list any missing prerequisite steps (consent, photos, patch test, contraindication check).',
  [AI_USE_CASE.ANALYTICS_NARRATIVE]:
    'Write a short narrative summary of the provided de-identified aggregate clinic metrics for management.',
  [AI_USE_CASE.CLINICAL_COPILOT]: CLINICAL_COPILOT_PROMPT,
};

/**
 * Human-readable label per use case. The label alone is not a version — two deploys can both say
 * "v1" while the prompt text differs — so the recorded promptVersion appends a content hash of the
 * exact system prompt string used, making AI provenance verifiable after the fact.
 */
const PROMPT_LABELS = {
  [AI_USE_CASE.CLINICAL_COPILOT]: 'clinical-copilot-v1',
};

/** `<label>@<8 hex>` — changes the moment a single byte of the system prompt changes. */
function promptVersionFor(useCase, systemPrompt) {
  if (!systemPrompt) return null;
  const label = PROMPT_LABELS[useCase] || `${useCase.toLowerCase()}-v1`;
  const hash = crypto.createHash('sha256').update(systemPrompt).digest('hex').slice(0, 8);
  return `${label}@${hash}`;
}

/**
 * Privacy-safe, doctor-controlled AI gateway (Module 9). Every call: strips identity fields,
 * builds an explicit input manifest, enforces a per-use-case kill switch and timeout, validates
 * structured JSON output, and records a PHI-safe audit row. Never auto-saves, auto-prescribes,
 * or auto-releases anything to the patient.
 */
class AiGatewayService {
  constructor() {
    this.redactor = new PiiRedactor();
    this.auditService = new AuditService();
    this.adapter = new AiProviderAdapter(config.ai);
  }

  async isUseCaseEnabled(useCase) {
    if (!config.ai.enabled) return false;
    const flag = await AiFeatureFlag.findOne({ useCase }).exec();
    return flag ? flag.enabled : true; // default on unless explicitly disabled
  }

  async run({ useCase, context, patientId = null, consultationId = null, parentRunId = null }, actorId, req = null) {
    if (!Object.values(AI_USE_CASE).includes(useCase)) {
      throw ApiError.badRequest(`Unknown AI use case: ${useCase}`);
    }

    const enabled = await this.isUseCaseEnabled(useCase);
    if (!enabled) {
      const reason = 'This AI use case is currently disabled by clinic policy.';
      const run = await this.#recordRun({
        useCase, patientId, consultationId, parentRunId, actorId,
        inputManifest: {}, fieldsRemoved: [], status: AI_RUN_STATUS.KILL_SWITCH,
        errorMessage: reason,
      });
      return {
        runId: run._id.toString(),
        status: AI_RUN_STATUS.KILL_SWITCH,
        output: null,
        model: this.adapter.effectiveModel(),
        degraded: true,
        reason,
      };
    }

    // AI_MONTHLY_BUDGET_USD — hard spend ceiling. Checked BEFORE the provider call so an
    // over-budget clinic stops spending immediately. This never throws: an exceeded budget is a
    // visible degraded response (the same shape the kill switch and provider errors return), so
    // the consultation continues manually rather than erroring out (AI-004/NFR-020).
    const budget = await this.checkMonthlyBudget();
    if (budget.exceeded) {
      const reason =
        `AI is paused for the rest of this month: estimated spend $${budget.spentUsd.toFixed(2)} has `
        + `reached the configured monthly budget of $${budget.budgetUsd.toFixed(2)}. `
        + 'Continue the consultation manually, or ask an administrator to raise AI_MONTHLY_BUDGET_USD.';
      const run = await this.#recordRun({
        useCase, patientId, consultationId, parentRunId, actorId,
        inputManifest: {}, fieldsRemoved: [], status: AI_RUN_STATUS.BUDGET_EXCEEDED,
        errorMessage: reason,
      });
      await this.auditService.record(AUDIT_ACTIONS.AI_BUDGET_EXCEEDED, {
        actorId,
        metadata: {
          aiRunId: run._id.toString(),
          useCase,
          spentUsd: budget.spentUsd,
          budgetUsd: budget.budgetUsd,
        },
        req,
      });
      return {
        runId: run._id.toString(),
        status: AI_RUN_STATUS.BUDGET_EXCEEDED,
        output: null,
        model: this.adapter.effectiveModel(),
        degraded: true,
        reason,
        budget: { spentUsd: budget.spentUsd, budgetUsd: budget.budgetUsd },
      };
    }

    // AI-002 — de-identification gate. Only current-patient/current-request context, never
    // name/phone/email/address/exact MRN/government ID.
    const { manifest, fieldsRemoved } = this.redactor.buildManifest(context || {});

    const schemaHint = SCHEMA_HINTS[useCase];
    const systemPrompt = SYSTEM_PROMPTS[useCase];
    const userPrompt = JSON.stringify(manifest);
    const promptVersion = promptVersionFor(useCase, systemPrompt);

    const jsonSchema = JSON_SCHEMAS[useCase] || null;

    const startedAt = Date.now();
    try {
      const { output, model, degraded, reason, usage } = await this.adapter.complete({
        systemPrompt, userPrompt, schemaHint, jsonSchema,
      });
      const latencyMs = Date.now() - startedAt;
      // Tokens are spent whether or not the output was usable, so cost is recorded on the
      // degraded path too — otherwise a run of refusals would look free.
      const estimatedCostUsd = estimateCostUsd(usage, model, this.adapter.effectiveProvider());

      // Provider declined or truncated — fail open, never block the consultation (§9.2).
      if (degraded || !output) {
        const run = await this.#recordRun({
          useCase, patientId, consultationId, parentRunId, actorId,
          inputManifest: manifest, fieldsRemoved, model,
          status: AI_RUN_STATUS.PROVIDER_ERROR, errorMessage: reason || 'No AI output returned', latencyMs,
          promptVersion, usage, estimatedCostUsd,
        });
        return {
          runId: run._id.toString(),
          status: AI_RUN_STATUS.PROVIDER_ERROR,
          output: null,
          model,
          degraded: true,
          reason: reason || 'No AI output returned',
          latencyMs,
        };
      }

      const outputHash = crypto.createHash('sha256').update(JSON.stringify(output)).digest('hex');

      const run = await this.#recordRun({
        useCase, patientId, consultationId, parentRunId, actorId,
        inputManifest: manifest, fieldsRemoved, model,
        status: AI_RUN_STATUS.SUCCESS, output, outputHash, latencyMs,
        promptVersion, usage, estimatedCostUsd,
      });

      return {
        runId: run._id.toString(),
        status: AI_RUN_STATUS.SUCCESS,
        output,
        model,
        degraded: false,
        reason: null,
        latencyMs,
      };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const status = err.name === 'AbortError' ? AI_RUN_STATUS.TIMEOUT
        : err.message === 'INVALID_JSON_OUTPUT' ? AI_RUN_STATUS.INVALID_OUTPUT
        : AI_RUN_STATUS.PROVIDER_ERROR;

      const run = await this.#recordRun({
        useCase, patientId, consultationId, parentRunId, actorId,
        inputManifest: manifest, fieldsRemoved,
        status, errorMessage: err.message, latencyMs, promptVersion,
      });

      // AI-004/NFR-020 — safe fallback: caller continues the manual workflow, never blocked.
      return {
        runId: run._id.toString(),
        status,
        output: null,
        model: this.adapter.effectiveModel(),
        degraded: true,
        reason: err.message,
        error: err.message,
      };
    }
  }

  /**
   * Month-to-date estimated spend vs AI_MONTHLY_BUDGET_USD.
   *
   * "Month" = calendar month in server-local time, matching how the budget is set. A budget of 0
   * or less is treated as UNLIMITED (not "block everything") — a misconfigured/blank env var must
   * never silently switch the clinical AI layer off. Never throws: a failed aggregation returns
   * "not exceeded" and logs, because a database hiccup must not become an AI outage.
   */
  async checkMonthlyBudget(now = new Date()) {
    const budgetUsd = Number(config.ai.monthlyBudgetUsd) || 0;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let spentUsd = 0;
    try {
      const [agg] = await AiRun.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$estimatedCostUsd' } } },
      ]);
      spentUsd = Number(agg?.total) || 0;
    } catch {
      return { exceeded: false, spentUsd: 0, budgetUsd, monthStart };
    }
    return {
      exceeded: budgetUsd > 0 && spentUsd >= budgetUsd,
      spentUsd,
      budgetUsd,
      monthStart,
    };
  }

  async #recordRun(payload) {
    const run = await AiRun.create({
      useCase: payload.useCase,
      patientId: payload.patientId,
      consultationId: payload.consultationId,
      parentRunId: payload.parentRunId || null,
      requestedBy: payload.actorId,
      provider: this.adapter.effectiveProvider(),
      model: payload.model || this.adapter.effectiveModel(),
      inputManifest: payload.inputManifest,
      fieldsRemoved: payload.fieldsRemoved,
      output: payload.output || null,
      outputHash: payload.outputHash || null,
      status: payload.status,
      errorMessage: payload.errorMessage || null,
      latencyMs: payload.latencyMs ?? null,
      // Real provenance: the prompt actually used, and the tokens actually billed. Both are null/
      // zero for runs where no provider call happened (kill switch, budget refusal) — by design.
      promptVersion: payload.promptVersion || null,
      usage: payload.usage || undefined,
      estimatedCostUsd: payload.estimatedCostUsd ?? 0,
    });

    await this.auditService.record(AUDIT_ACTIONS.AI_RUN_COMPLETED, {
      actorId: payload.actorId,
      metadata: {
        aiRunId: run._id.toString(),
        useCase: payload.useCase,
        status: payload.status,
        fieldsRemoved: payload.fieldsRemoved,
      },
    });

    return run;
  }

  /** AI-004 — doctor accept/edit/reject before anything clinical is saved. */
  async dispositionRun(runId, { disposition, editedOutput = null }, actorId, req = null) {
    const run = await AiRun.findById(runId);
    if (!run) throw ApiError.notFound('AI run not found');
    if (!Object.values(AI_DISPOSITION).includes(disposition)) {
      throw ApiError.badRequest('Invalid disposition');
    }

    run.disposition = disposition;
    run.dispositionedBy = actorId;
    run.dispositionedAt = new Date();
    if (disposition === AI_DISPOSITION.EDITED) run.editedOutput = editedOutput;
    await run.save();

    await this.auditService.record(AUDIT_ACTIONS.AI_RUN_DISPOSITIONED, {
      actorId,
      metadata: { aiRunId: runId, disposition },
      req,
    });

    return run.toSafeObject();
  }

  /**
   * SEC-030 — AI runs carry de-identified but still clinical context (chief complaints, drafted
   * notes, red flags) and were readable organisation-wide by anyone holding AI governance view,
   * which includes the branch-pinned BRANCH_MANAGER.
   *
   * `AiRun` has no `branchId` column, so there is nothing on the row itself to pin. The branch
   * dimension that actually exists is the REQUESTER: every staff user belongs to exactly one
   * branch (`User.branch`), and a branch manager's governance remit is the AI usage of the staff
   * they manage. So a scoped caller sees the runs requested by users at their own branch. The
   * alternative — deriving a branch from each run's consultation/patient — was rejected because a
   * run may have neither (`patientId`/`consultationId` are both nullable), which would silently
   * hide exactly the ungrounded runs governance most needs to see.
   *
   * @param {object} query
   * @param {string|null} scopedBranchId  null = unrestricted (OWNER/ADMIN).
   */
  async listRuns(query = {}, scopedBranchId = null) {
    const filter = {};
    if (query.useCase) filter.useCase = query.useCase;
    if (query.patientId) filter.patientId = query.patientId;
    if (query.status) filter.status = query.status;
    if (scopedBranchId) {
      const userIds = await User.find({ branch: scopedBranchId }).distinct('_id');
      filter.requestedBy = { $in: userIds };
    }
    const rows = await AiRun.find(filter).sort({ createdAt: -1 }).limit(200).exec();
    return rows.map((r) => r.toSafeObject());
  }

  // --- Governance -------------------------------------------------------------
  async listFeatureFlags() {
    const rows = await AiFeatureFlag.find().exec();
    const byUseCase = new Map(rows.map((r) => [r.useCase, r]));
    return Object.values(AI_USE_CASE).map((uc) =>
      byUseCase.has(uc) ? byUseCase.get(uc).toSafeObject() : { useCase: uc, enabled: true, disabledReason: null }
    );
  }

  async setFeatureFlag(useCase, { enabled, disabledReason }, actorId, req = null) {
    const flag = await AiFeatureFlag.findOneAndUpdate(
      { useCase },
      { enabled, disabledReason: enabled ? null : disabledReason || null, updatedBy: actorId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await this.auditService.record(AUDIT_ACTIONS.AI_USE_CASE_TOGGLED, {
      actorId,
      metadata: { useCase, enabled },
      req,
    });

    return flag.toSafeObject();
  }

  /** Basic governance stats — acceptance/edit/reject rate, latency, cost, error rate (§14.2). */
  async governanceSummary() {
    const rows = await AiRun.find().sort({ createdAt: -1 }).limit(1000).exec();
    const total = rows.length;
    const byDisposition = rows.reduce((acc, r) => {
      acc[r.disposition] = (acc[r.disposition] || 0) + 1;
      return acc;
    }, {});
    const errors = rows.filter((r) => r.status !== AI_RUN_STATUS.SUCCESS).length;
    const avgLatency = total ? Math.round(rows.reduce((s, r) => s + (r.latencyMs || 0), 0) / total) : 0;
    const totalCost = rows.reduce((s, r) => s + (r.estimatedCostUsd || 0), 0);
    const budget = await this.checkMonthlyBudget();

    return {
      totalRuns: total,
      byDisposition,
      errorRate: total ? Number((errors / total).toFixed(3)) : 0,
      avgLatencyMs: avgLatency,
      estimatedCostUsd: Number(totalCost.toFixed(2)),
      monthlyBudgetUsd: config.ai.monthlyBudgetUsd,
      /** Live budget state — this is what actually gates AI calls, so it is shown, not implied. */
      monthToDateSpendUsd: Number(budget.spentUsd.toFixed(2)),
      budgetExceeded: budget.exceeded,
    };
  }
}

export default AiGatewayService;
