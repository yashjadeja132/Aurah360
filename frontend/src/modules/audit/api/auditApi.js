import api from '@/services/api';

/**
 * NFR-018 — read side of the audit trail. The backend endpoint
 * (GET /audit/entries) already existed and was fully gated (audit.view,
 * branch scope, opt-in metadata); this client just calls it.
 */
export const auditApi = {
  search(params) {
    return api.get('/audit/entries', { params }).then((r) => r.data);
  },
};

export default auditApi;
