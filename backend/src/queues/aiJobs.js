import { QUEUE_NAMES, enqueueJob } from './connection.js';
import logger from '../libs/logger.js';

export const AI_JOBS = Object.freeze({
  CLINICAL_PRECHECK: 'clinical-precheck',
});

/**
 * Queue a clinical precheck for a consultation. Fire-and-forget: reception's intake
 * completes whether or not the job lands (enqueueJob resolves null when Redis is down).
 * attempts: 1 — AiGatewayService resolves rather than throws on degraded outcomes, so a
 * BullMQ retry would only ever re-bill a genuine provider timeout against the AI budget.
 */
export async function enqueueClinicalPrecheck(consultationId, actorId, { force = false } = {}) {
  const job = await enqueueJob(
    QUEUE_NAMES.AI,
    AI_JOBS.CLINICAL_PRECHECK,
    { consultationId: String(consultationId), actorId: actorId ? String(actorId) : null, force },
    { attempts: 1 }
  );
  if (!job) {
    logger.warn('Clinical precheck enqueue dropped (queue unavailable)', {
      consultationId: String(consultationId),
    });
  }
  return job;
}

/** Composed-worker module for startComposedWorker(QUEUE_NAMES.AI, [aiPrecheckHandlerModule]). */
export const aiPrecheckHandlerModule = {
  jobNames: [AI_JOBS.CLINICAL_PRECHECK],
  async handle(job) {
    const { consultationId, actorId, force } = job.data || {};
    if (!consultationId) return { skipped: 'no consultationId' };
    const { default: ClinicalPrecheckService } = await import(
      '../services/ai/ClinicalPrecheckService.js'
    );
    const result = await new ClinicalPrecheckService().runForConsultation(consultationId, actorId, {
      force: Boolean(force),
    });
    return { status: result.status, degraded: result.degraded };
  },
};
