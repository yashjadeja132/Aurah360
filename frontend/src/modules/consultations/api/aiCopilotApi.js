import api from '@/services/api';

/**
 * Consultation AI copilot transport. Matches the fixed backend contract:
 *   POST /ai/copilot                     -> { runId, output, model, degraded, reason }
 *   POST /ai/copilot/:runId/refine       -> same shape, narrowed by Q&A
 *   POST /ai/runs/:runId/disposition     -> audit record for accept / edit / reject
 */
export const aiCopilotApi = {
  run({ consultationId, patientId, includePhotos }) {
    return api
      .post('/ai/copilot', { consultationId, patientId, includePhotos: Boolean(includePhotos) })
      .then((r) => r.data);
  },
  refine(runId, answers) {
    return api.post(`/ai/copilot/${runId}/refine`, { answers }).then((r) => r.data);
  },
  disposition(runId, disposition, editedOutput) {
    return api
      .post(`/ai/runs/${runId}/disposition`, {
        disposition,
        ...(editedOutput === undefined ? {} : { editedOutput }),
      })
      .then((r) => r.data);
  },
};

export default aiCopilotApi;
