import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { loyaltyApi } from '../api/loyaltyApi';

/**
 * TanStack Query hooks for the Loyalty & Rewards module. Query-key/invalidation
 * conventions mirror useCrm.js (frontend/src/modules/crm/hooks/useCrm.js) — a
 * local ['loyalty', ...] key namespace and a broad invalidate() on writes since
 * loyalty.settings/queryKeys.js is not part of this module's touch scope.
 */

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

function invalidate(qc) {
  qc.invalidateQueries({ queryKey: ['loyalty'] });
}

export const LOYALTY_QUERY_KEYS = {
  SETTINGS: () => ['loyalty', 'settings'],
  RULES: (params) => ['loyalty', 'rules', params],
  RULE: (id) => ['loyalty', 'rule', id],
  TIERS: (params) => ['loyalty', 'tiers', params],
  CAMPAIGNS: (params) => ['loyalty', 'campaigns', params],
  ADJUSTMENT_QUEUE: (params) => ['loyalty', 'adjustments', 'queue', params],
  PATIENT_BALANCE: (patientId) => ['loyalty', 'patient-balance', patientId],
  PATIENT_LEDGER: (patientId, params) => ['loyalty', 'patient-ledger', patientId, params],
  PATIENT_TIER: (patientId) => ['loyalty', 'patient-tier', patientId],
  DASHBOARD_SUMMARY: (params) => ['loyalty', 'dashboard-summary', params],
};

// --- Settings ---

export function useLoyaltySettings(params) {
  return useQuery({
    queryKey: LOYALTY_QUERY_KEYS.SETTINGS(),
    queryFn: async () => (await loyaltyApi.getSettings(params)).data,
  });
}

export function useUpdateLoyaltySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => loyaltyApi.updateSettings(payload),
    onSuccess: () => {
      toast.success('Loyalty program settings updated');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to update settings')),
  });
}

// --- Rules ---

export function useLoyaltyRules(params = {}) {
  return useQuery({
    queryKey: LOYALTY_QUERY_KEYS.RULES(params),
    queryFn: async () => {
      const res = await loyaltyApi.listRules(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useCreateLoyaltyRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => loyaltyApi.createRule(payload),
    onSuccess: () => {
      toast.success('Earning rule created');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to create rule')),
  });
}

export function useAddRuleVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => loyaltyApi.addRuleVersion(id, payload),
    onSuccess: () => {
      toast.success('New rule version added');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to add rule version')),
  });
}

// --- Tiers ---

export function useLoyaltyTiers(params = {}) {
  return useQuery({
    queryKey: LOYALTY_QUERY_KEYS.TIERS(params),
    queryFn: async () => {
      const res = await loyaltyApi.listTiers(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useUpsertLoyaltyTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => loyaltyApi.upsertTier(payload),
    onSuccess: () => {
      toast.success('Tier saved');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to save tier')),
  });
}

// --- Campaigns ---

export function useLoyaltyCampaigns(params = {}) {
  return useQuery({
    queryKey: LOYALTY_QUERY_KEYS.CAMPAIGNS(params),
    queryFn: async () => {
      const res = await loyaltyApi.listCampaigns(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useCreateLoyaltyCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => loyaltyApi.createCampaign(payload),
    onSuccess: () => {
      toast.success('Campaign created');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to create campaign')),
  });
}

export function useUpdateCampaignStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => loyaltyApi.updateCampaignStatus(id, status),
    onSuccess: () => {
      toast.success('Campaign status updated');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to update campaign status')),
  });
}

// --- Adjustment queue ---

export function useAdjustmentQueue(params = {}) {
  return useQuery({
    queryKey: LOYALTY_QUERY_KEYS.ADJUSTMENT_QUEUE(params),
    queryFn: async () => {
      const res = await loyaltyApi.listAdjustmentQueue(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useApproveAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => loyaltyApi.approveAdjustment(id, payload),
    onSuccess: () => {
      toast.success('Adjustment approved');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to approve adjustment')),
  });
}

export function useRejectAdjustment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => loyaltyApi.rejectAdjustment(id, payload),
    onSuccess: () => {
      toast.success('Adjustment rejected');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to reject adjustment')),
  });
}

// --- Patient balance/ledger ---

export function usePatientBalance(patientId) {
  return useQuery({
    queryKey: LOYALTY_QUERY_KEYS.PATIENT_BALANCE(patientId),
    queryFn: async () => (await loyaltyApi.getPatientBalance(patientId)).data,
    enabled: Boolean(patientId),
  });
}

export function usePatientLedger(patientId, params = {}) {
  return useQuery({
    queryKey: LOYALTY_QUERY_KEYS.PATIENT_LEDGER(patientId, params),
    queryFn: async () => {
      const res = await loyaltyApi.getPatientLedger(patientId, params);
      return { items: res.data || [], meta: res.meta };
    },
    enabled: Boolean(patientId),
  });
}

export function usePatientTierProgress(patientId) {
  return useQuery({
    queryKey: LOYALTY_QUERY_KEYS.PATIENT_TIER(patientId),
    queryFn: async () => (await loyaltyApi.getPatientTierProgress(patientId)).data,
    enabled: Boolean(patientId),
  });
}

// --- Manual adjustment (LOY-008) ---

export function useCreatePatientAdjustment(patientId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => loyaltyApi.createPatientAdjustment(patientId, payload),
    onSuccess: () => {
      toast.success('Loyalty adjustment recorded');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to record adjustment')),
  });
}

// --- Billing redemption ---

export function useApplyLoyaltyRedemption(invoiceId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => loyaltyApi.applyRedemption(invoiceId, payload),
    onSuccess: () => {
      toast.success('Loyalty redemption applied');
      invalidate(qc);
      qc.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to apply redemption')),
  });
}

export function useRemoveLoyaltyRedemption(invoiceId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => loyaltyApi.removeRedemption(invoiceId),
    onSuccess: () => {
      toast.success('Loyalty redemption removed');
      invalidate(qc);
      qc.invalidateQueries({ queryKey: ['billing'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to remove redemption')),
  });
}

// --- Dashboard ---

export function useLoyaltyDashboardSummary(params = {}) {
  return useQuery({
    queryKey: LOYALTY_QUERY_KEYS.DASHBOARD_SUMMARY(params),
    queryFn: async () => (await loyaltyApi.getDashboardSummary(params)).data,
  });
}

// --- Client-side preview calculator (see loyaltyApi.getPreviewCalculation) ---

export function useLoyaltyPreviewCalculation(ruleDraft, amountInr) {
  return loyaltyApi.getPreviewCalculation(ruleDraft, amountInr);
}
