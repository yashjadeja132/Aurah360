import api from '@/services/api';

/**
 * SEC-002 — the first (and, for now, only) frontend caller of POST /auth/step-up. Accepts
 * either the current password or a 6-digit MFA code (backend accepts either). Returns
 * { stepUpToken } which the caller must attach as the `x-step-up-token` header on the
 * privileged request it is unlocking.
 */
export const stepUpApi = {
  verify(payload) {
    return api.post('/auth/step-up', payload).then((r) => r.data);
  },
};

export default stepUpApi;
