import api from '@/services/api';

export const privacyApi = {
  listBreakGlassGrants(params) {
    return api.get('/privacy/break-glass', { params }).then((r) => r.data);
  },
  listRequests(params) {
    return api.get('/privacy/requests', { params }).then((r) => r.data);
  },
  openRequest(payload) {
    return api.post('/privacy/requests', payload).then((r) => r.data);
  },
  verifyIdentity(id) {
    return api.post(`/privacy/requests/${id}/verify-identity`).then((r) => r.data);
  },
  resolveRequest(id, payload) {
    return api.post(`/privacy/requests/${id}/resolve`, payload).then((r) => r.data);
  },
};

export default privacyApi;
