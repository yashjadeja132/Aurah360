import api from '@/services/api';

/**
 * REST client for the Loyalty & Rewards (LOY) module. Paths follow the same
 * `/api/loyalty/...` base pattern used by sibling modules (see crmApi.js,
 * inventory api files). Some endpoints (e.g. the dry-run preview calculator)
 * are not yet wired on the backend — see getPreviewCalculation below.
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
   * getPreviewCalculation — CLIENT-SIDE APPROXIMATION.
   *
   * No dry-run/preview endpoint is wired on the backend yet for LoyaltyEarningRule
   * versions, so this reproduces the formula/rounding semantics implied by
   * LOYALTY_POINT_FORMULA_TYPE and LOYALTY_ROUNDING_RULE (backend/src/enums/loyalty.js)
   * purely in the browser, so admins get an instant preview while editing a rule
   * draft. This does NOT apply eligibility, caps, or campaign multipliers server-side
   * and MUST be replaced with a real POST /loyalty/rules/preview call once the
   * backend team ships one — the shape of `ruleDraft` here matches ruleVersionSchema
   * so swapping this for a real request is a drop-in change.
   */
  getPreviewCalculation(ruleDraft, amountInr = 0) {
    const { formulaType, pointValue = 0, perAmountInr = 1, roundingRule = 'FLOOR' } = ruleDraft || {};
    let raw = 0;
    if (formulaType === 'FIXED') {
      raw = Number(pointValue) || 0;
    } else if (formulaType === 'PER_AMOUNT') {
      const per = Number(perAmountInr) || 1;
      raw = (Number(amountInr) / per) * (Number(pointValue) || 0);
    } else if (formulaType === 'PERCENT_OF_AMOUNT') {
      raw = (Number(amountInr) * (Number(pointValue) || 0)) / 100;
    }

    let points;
    if (roundingRule === 'CEILING') points = Math.ceil(raw);
    else if (roundingRule === 'ROUND') points = Math.round(raw);
    else points = Math.floor(raw); // FLOOR (default)

    const capped = applyCaps(points, ruleDraft);
    return {
      isClientSideEstimate: true,
      rawPoints: raw,
      roundedPoints: points,
      cappedPoints: capped.value,
      capApplied: capped.capApplied,
    };
  },
};

function applyCaps(points, ruleDraft = {}) {
  const caps = [ruleDraft.perEventCap, ruleDraft.perDayCap, ruleDraft.perMonthCap, ruleDraft.lifetimeCap].filter(
    (c) => c !== null && c !== undefined && c !== ''
  );
  if (!caps.length) return { value: points, capApplied: false };
  const min = Math.min(points, ...caps.map(Number));
  return { value: min, capApplied: min < points };
}

export default loyaltyApi;
