import api from '@/services/api';

/**
 * REST client for the Loyalty & Rewards (LOY) module. Paths follow the same
 * `/api/loyalty/...` base pattern used by sibling modules (see crmApi.js,
 * inventory api files). The rule preview calculator is a real server-side dry run
 * (POST /loyalty/rules/preview) — see getPreviewCalculation below.
 */
export const loyaltyApi = {
  // --- LOY-001: Program settings (versioned, effective-dated) ---
  getSettings(params) {
    return api.get('/loyalty/settings', { params }).then((r) => r.data);
  },
  updateSettings(payload) {
    return api.put('/loyalty/settings', payload).then((r) => r.data);
  },

  // --- LOY-002: Earning rules ---
  listRules(params) {
    return api.get('/loyalty/rules', { params }).then((r) => r.data);
  },
  getRule(id) {
    return api.get(`/loyalty/rules/${id}`).then((r) => r.data);
  },
  createRule(payload) {
    return api.post('/loyalty/rules', payload).then((r) => r.data);
  },
  addRuleVersion(id, payload) {
    return api.post(`/loyalty/rules/${id}/versions`, payload).then((r) => r.data);
  },

  // --- LOY-012: Tiers ---
  listTiers(params) {
    return api.get('/loyalty/tiers', { params }).then((r) => r.data);
  },
  upsertTier(payload) {
    const { id, ...body } = payload || {};
    return id
      ? api.patch(`/loyalty/tiers/${id}`, body).then((r) => r.data)
      : api.post('/loyalty/tiers', body).then((r) => r.data);
  },

  // --- LOY-013: Campaigns ---
  listCampaigns(params) {
    return api.get('/loyalty/campaigns', { params }).then((r) => r.data);
  },
  createCampaign(payload) {
    return api.post('/loyalty/campaigns', payload).then((r) => r.data);
  },
  updateCampaignStatus(id, status) {
    return api.post(`/loyalty/campaigns/${id}/status`, { status }).then((r) => r.data);
  },

  // --- LOY-008: Manual adjustment approval queue ---
  listAdjustmentQueue(params) {
    return api.get('/loyalty/adjustments/queue', { params }).then((r) => r.data);
  },
  approveAdjustment(id, payload) {
    return api.post(`/loyalty/adjustments/${id}/approve`, payload).then((r) => r.data);
  },
  rejectAdjustment(id, payload) {
    return api.post(`/loyalty/adjustments/${id}/reject`, payload).then((r) => r.data);
  },

  // --- Patient balance/ledger (LOY-003/LOY-005) ---
  getPatientBalance(patientId) {
    return api.get(`/loyalty/patients/${patientId}/balance`).then((r) => r.data);
  },
  getPatientLedger(patientId, params) {
    return api.get(`/loyalty/patients/${patientId}/ledger`, { params }).then((r) => r.data);
  },
  /** Current tier + rolling progress toward next tier (only meaningful when tiersEnabled). */
  getPatientTierProgress(patientId) {
    return api.get(`/loyalty/patients/${patientId}/tier`).then((r) => r.data);
  },
  /** Manual credit/debit adjustment — reasonCategory + note are mandatory (LOY-008). */
  createPatientAdjustment(patientId, payload) {
    return api.post(`/loyalty/patients/${patientId}/adjustments`, payload).then((r) => r.data);
  },

  // --- Billing redemption (applied/removed on a DRAFT invoice) ---
  applyRedemption(invoiceId, payload) {
    return api.post(`/billing/${invoiceId}/apply-loyalty-redemption`, payload).then((r) => r.data);
  },
  removeRedemption(invoiceId) {
    return api.post(`/billing/${invoiceId}/remove-loyalty-redemption`).then((r) => r.data);
  },

  // --- Dashboard/reports (LOY-011-ish) ---
  getDashboardSummary(params) {
    return api.get('/loyalty/reports/summary', { params }).then((r) => r.data);
  },

  /**
   * getPreviewCalculation — server-side DRY RUN of a rule-version draft (LOY-002).
   *
   * POST /loyalty/rules/preview runs the draft through the real earning engine
   * (LoyaltyEarningEngineService.previewPoints) and writes nothing. `ruleDraft` is the
   * ruleVersionSchema shape; extra editor-only keys are ignored by the backend
   * validator. Pass patientId/branchId/serviceId to also simulate eligibility and
   * ledger-backed caps.
   */
  getPreviewCalculation(ruleDraft, amountInr = 0, simulate = {}) {
    return api
      .post('/loyalty/rules/preview', { ...(ruleDraft || {}), ...simulate, amountInr })
      .then((r) => r.data);
  },
};

export default loyaltyApi;
