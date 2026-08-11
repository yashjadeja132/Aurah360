import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { billingOpsApi } from '../api/billingOpsApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

export function useCashSession(params = {}) {
  return useQuery({
    queryKey: ['billing-ops', 'cash-session', params],
    queryFn: async () => {
      const res = await billingOpsApi.getCashSession(params);
      return res.data.session;
    },
    enabled: Boolean(params.branchId),
  });
}

export function useOpenCashSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => billingOpsApi.openCashSession(payload),
    onSuccess: () => {
      toast.success('Cash session opened');
      qc.invalidateQueries({ queryKey: ['billing-ops', 'cash-session'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not open cash session')),
  });
}

export function useCashCloses(params = {}) {
  return useQuery({
    queryKey: ['billing-ops', 'cash-close', params],
    queryFn: async () => {
      const res = await billingOpsApi.listCashCloses(params);
      return res.data.closes || [];
    },
  });
}

export function useSubmitCashClose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => billingOpsApi.submitCashClose(payload),
    onSuccess: () => {
      toast.success('Cash close submitted');
      qc.invalidateQueries({ queryKey: ['billing-ops', 'cash-close'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not submit cash close')),
  });
}

export function useApproveCashClose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => billingOpsApi.approveCashClose(id),
    onSuccess: () => {
      toast.success('Cash close approved');
      qc.invalidateQueries({ queryKey: ['billing-ops', 'cash-close'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not approve')),
  });
}

export function useFeeSchedules(params = {}) {
  return useQuery({
    queryKey: ['billing-ops', 'fee-schedules', params],
    queryFn: async () => {
      const res = await billingOpsApi.listFeeSchedules(params);
      return res.data.feeSchedules || [];
    },
  });
}

export function useCreateFeeSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => billingOpsApi.createFeeSchedule(payload),
    onSuccess: () => {
      toast.success('Fee schedule created');
      qc.invalidateQueries({ queryKey: ['billing-ops', 'fee-schedules'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not create fee schedule')),
  });
}

export function useDeactivateFeeSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => billingOpsApi.deactivateFeeSchedule(id),
    onSuccess: () => {
      toast.success('Fee schedule deactivated');
      qc.invalidateQueries({ queryKey: ['billing-ops', 'fee-schedules'] });
    },
  });
}
