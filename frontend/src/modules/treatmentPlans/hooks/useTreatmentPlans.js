import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { treatmentPlansApi } from '../api/treatmentPlansApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

function invalidateAll(qc) {
  qc.invalidateQueries({ queryKey: ['treatment-plans'] });
}

export function useTreatmentPlan(id) {
  return useQuery({
    queryKey: QUERY_KEYS.TREATMENT_PLAN_DETAIL(id),
    queryFn: async () => {
      const res = await treatmentPlansApi.getById(id);
      return res.data.plan;
    },
    enabled: Boolean(id),
  });
}

export function useDoctorTreatmentPlans(doctorId, params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.TREATMENT_PLAN_DOCTOR_LIST(doctorId, params),
    queryFn: async () => {
      const res = await treatmentPlansApi.listByDoctor({ doctorId, ...params });
      return res.data || [];
    },
    // undefined means "let the backend infer the caller's own doctor profile" (DOCTOR role);
    // only an explicit '' (nothing picked yet, non-doctor staff view) disables the query.
    enabled: doctorId !== '',
  });
}

/** All treatment plans for one patient — GET /treatment-plans/patient/:patientId. */
export function usePatientTreatmentPlans(patientId) {
  return useQuery({
    queryKey: QUERY_KEYS.TREATMENT_PLAN_PATIENT_LIST(patientId),
    queryFn: async () => {
      const res = await treatmentPlansApi.listByPatient(patientId);
      return res.data || [];
    },
    enabled: Boolean(patientId),
  });
}

export function useProtocols(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.TREATMENT_PROTOCOLS(params),
    queryFn: async () => {
      const res = await treatmentPlansApi.listProtocols(params);
      return res.data || [];
    },
  });
}

export function usePackages(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.TREATMENT_PACKAGES(params),
    queryFn: async () => {
      const res = await treatmentPlansApi.listPackages(params);
      return res.data || [];
    },
  });
}

export function useCreateTreatmentPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => treatmentPlansApi.create(payload),
    onSuccess: () => {
      toast.success('Treatment plan created');
      invalidateAll(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Create failed')),
  });
}

export function useUpdateTreatmentPlan(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => treatmentPlansApi.update(id, payload),
    onSuccess: () => {
      toast.success('Plan saved');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_PLAN_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Save failed')),
  });
}

export function useApplyProtocol(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (protocolId) => treatmentPlansApi.applyProtocol(id, protocolId),
    onSuccess: () => {
      toast.success('Protocol applied');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_PLAN_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Protocol apply failed')),
  });
}

export function useApplyPackage(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (packageId) => treatmentPlansApi.applyPackage(id, packageId),
    onSuccess: () => {
      toast.success('Package added');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_PLAN_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Package apply failed')),
  });
}

export function useRecommendPlan(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => treatmentPlansApi.recommend(id),
    onSuccess: () => {
      toast.success('Marked recommended');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_PLAN_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Action failed')),
  });
}

export function useApprovePlan(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => treatmentPlansApi.approve(id),
    onSuccess: () => {
      toast.success('Plan approved');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_PLAN_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Approve failed')),
  });
}

export function useAcceptPlan(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => treatmentPlansApi.accept(id),
    onSuccess: () => {
      toast.success('Plan accepted');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_PLAN_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Accept failed')),
  });
}

export function useRejectPlan(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason) => treatmentPlansApi.reject(id, reason),
    onSuccess: () => {
      toast.success('Plan rejected');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_PLAN_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Reject failed')),
  });
}

/** Cross-patient "Treatment plans awaiting approval" queue — mirrors useLabOrderReviewQueue. */
export function usePendingApprovalQueue(params = {}) {
  return useQuery({
    queryKey: ['treatment-plans', 'pending-approval', params],
    queryFn: async () => {
      const res = await treatmentPlansApi.pendingApprovalQueue(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useHoldPlan(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note) => treatmentPlansApi.hold(id, note),
    onSuccess: () => {
      toast.success('Plan held for later');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ['treatment-plans', 'pending-approval'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Hold failed')),
  });
}

export function useUnholdPlan(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => treatmentPlansApi.unhold(id),
    onSuccess: () => {
      toast.success('Hold cleared');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ['treatment-plans', 'pending-approval'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Action failed')),
  });
}

export function useEscalatePlan(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => treatmentPlansApi.escalate(id, payload),
    onSuccess: () => {
      toast.success('Plan escalated for senior review');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: ['treatment-plans', 'pending-approval'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Escalate failed')),
  });
}

export function useCancelPlan(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => treatmentPlansApi.cancel(id),
    onSuccess: () => {
      toast.success('Plan cancelled');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_PLAN_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Cancel failed')),
  });
}

export function useAcceptConsent(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ consentId, ...payload }) =>
      treatmentPlansApi.acceptConsent(id, consentId, payload),
    onSuccess: () => {
      toast.success('Consent accepted');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_PLAN_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Consent failed')),
  });
}

export function useDeleteTreatmentPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId) => treatmentPlansApi.remove(planId),
    onSuccess: () => {
      toast.success('Draft deleted');
      invalidateAll(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Delete failed')),
  });
}

export function useCreateProtocol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => treatmentPlansApi.createProtocol(payload),
    onSuccess: () => {
      toast.success('Protocol created');
      qc.invalidateQueries({ queryKey: ['treatment-plans', 'protocols'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Protocol create failed')),
  });
}

export function useCreatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => treatmentPlansApi.createPackage(payload),
    onSuccess: () => {
      toast.success('Package created');
      qc.invalidateQueries({ queryKey: ['treatment-plans', 'packages'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Package create failed')),
  });
}
