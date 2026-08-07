import crypto from 'crypto';
import ApiError from '../../libs/ApiError.js';
import AiRun from '../../models/AiRun.model.js';
import AiFeatureFlag from '../../models/AiFeatureFlag.model.js';
import PiiRedactor from './PiiRedactor.js';
import AiProviderAdapter from './AiProviderAdapter.js';
import AuditService from '../AuditService.js';
import config from '../../config/index.js';
import { AUDIT_ACTIONS } from '../../enums/auditAction.js';
import { AI_USE_CASE, AI_RUN_STATUS, AI_DISPOSITION } from '../../enums/ai.js';

const SCHEMA_HINTS = {
  [AI_USE_CASE.SUGGESTED_QUESTIONS]: '{ "questions": string[] }',
  [AI_USE_CASE.RED_FLAG_ASSIST]: '{ "redFlags": string[], "notes": string }',
  [AI_USE_CASE.REPORT_SUMMARY]: '{ "summary": string, "abnormalItems": string[] }',
  [AI_USE_CASE.TIMELINE_SUMMARY]: '{ "summary": string }',
  [AI_USE_CASE.DRAFT_NOTE]: '{ "draftNote": { "subjective": string, "objective": string, "assessment": string, "plan": string } }',
  [AI_USE_CASE.PATIENT_INSTRUCTION_DRAFT]: '{ "instructions": string }',
  [AI_USE_CASE.TREATMENT_CHECKLIST_ASSIST]: '{ "checklist": string[] }',
  [AI_USE_CASE.ANALYTICS_NARRATIVE]: '{ "narrative": string }',
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
};

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

  async run({ useCase, context, patientId = null, consultationId = null }, actorId, req = null) {
    if (!Object.values(AI_USE_CASE).includes(useCase)) {
      throw ApiError.badRequest(`Unknown AI use case: ${useCase}`);
    }

    const enabled = await this.isUseCaseEnabled(useCase);
    if (!enabled) {
      const run = await this.#recordRun({
        useCase, patientId, consultationId, actorId,
        inputManifest: {}, fieldsRemoved: [], status: AI_RUN_STATUS.KILL_SWITCH,
        errorMessage: 'This AI use case is currently disabled by clinic policy.',
      });
      return { runId: run._id.toString(), status: AI_RUN_STATUS.KILL_SWITCH, output: null };
    }

    // AI-002 — de-identification gate. Only current-patient/current-request context, never
    // name/phone/email/address/exact MRN/government ID.
    const { manifest, fieldsRemoved } = this.redactor.buildManifest(context || {});

    const schemaHint = SCHEMA_HINTS[useCase];
    const systemPrompt = SYSTEM_PROMPTS[useCase];
    const userPrompt = JSON.stringify(manifest);

    const startedAt = Date.now();
    try {
      const { output } = await this.adapter.complete({ systemPrompt, userPrompt, schemaHint });
      const latencyMs = Date.now() - startedAt;
      const outputHash = crypto.createHash('sha256').update(JSON.stringify(output)).digest('hex');

      const run = await this.#recordRun({
        useCase, patientId, consultationId, actorId,
        inputManifest: manifest, fieldsRemoved,
        status: AI_RUN_STATUS.SUCCESS, output, outputHash, latencyMs,
      });

      return { runId: run._id.toString(), status: AI_RUN_STATUS.SUCCESS, output, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const status = err.name === 'AbortError' ? AI_RUN_STATUS.TIMEOUT
        : err.message === 'INVALID_JSON_OUTPUT' ? AI_RUN_STATUS.INVALID_OUTPUT
        : AI_RUN_STATUS.PROVIDER_ERROR;

      const run = await this.#recordRun({
        useCase, patientId, consultationId, actorId,
        inputManifest: manifest, fieldsRemoved,
        status, errorMessage: err.message, latencyMs,
      });

      // AI-004/NFR-020 — safe fallback: caller continues the manual workflow, never blocked.
      return { runId: run._id.toString(), status, output: null, error: err.message };
    }
  }

  async #recordRun(payload) {
    const run = await AiRun.create({
      useCase: payload.useCase,
      patientId: payload.patientId,
      consultationId: payload.consultationId,
      requestedBy: payload.actorId,
      provider: config.ai.provider,
      model: config.ai.model,
      inputManifest: payload.inputManifest,
      fieldsRemoved: payload.fieldsRemoved,
      output: payload.output || null,
      outputHash: payload.outputHash || null,
      status: payload.status,
      errorMessage: payload.errorMessage || null,
      latencyMs: payload.latencyMs || null,
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

  async listRuns(query = {}) {
    const filter = {};
    if (query.useCase) filter.useCase = query.useCase;
    if (query.patientId) filter.patientId = query.patientId;
    if (query.status) filter.status = query.status;
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

    return {
      totalRuns: total,
      byDisposition,
      errorRate: total ? Number((errors / total).toFixed(3)) : 0,
      avgLatencyMs: avgLatency,
      estimatedCostUsd: Number(totalCost.toFixed(2)),
      monthlyBudgetUsd: config.ai.monthlyBudgetUsd,
    };
  }
}

export default AiGatewayService;
