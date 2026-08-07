import api from '@/services/api';

export const aiApi = {
  listRuns(params) {
    return api.get('/ai/runs', { params }).then((r) => r.data);
  },
  governanceSummary() {
    return api.get('/ai/governance/summary').then((r) => r.data);
  },
  listFeatureFlags() {
    return api.get('/ai/governance/flags').then((r) => r.data);
  },
  setFeatureFlag(useCase, payload) {
    return api.post(`/ai/governance/flags/${useCase}`, payload).then((r) => r.data);
  },
};

export default aiApi;
