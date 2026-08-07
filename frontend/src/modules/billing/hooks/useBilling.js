import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { billingApi } from '../api/billingApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

function invalidateAll(qc) {
  qc.invalidateQueries({ queryKey: ['billing'] });
}

export function useInvoices(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.BILLING_LIST(params),
    queryFn: async () => {
      const res = await billingApi.list(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useInvoice(id) {
  return useQuery({
    queryKey: QUERY_KEYS.BILLING_DETAIL(id),
    queryFn: async () => {
      const res = await billingApi.getById(id);
      return res.data.invoice;
    },
    enabled: Boolean(id),
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => billingApi.create(payload),
    onSuccess: () => {
      toast.success('Invoice created');
      invalidateAll(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Create failed')),
  });
}

export function useCreateInvoiceFromPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId) => billingApi.createFromPlan(planId),
    onSuccess: () => {
      toast.success('Invoice created from plan');
      invalidateAll(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Create from plan failed')),
  });
}

export function useUpdateInvoice(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => billingApi.update(id, payload),
    onSuccess: () => {
      toast.success('Invoice saved');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Save failed')),
  });
}

export function useFinalizeInvoice(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => billingApi.finalize(id),
    onSuccess: () => {
      toast.success('Invoice finalized');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Finalize failed')),
  });
}

export function useVoidInvoice(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason) => billingApi.voidDraft(id, reason),
    onSuccess: () => {
      toast.success('Draft voided');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Void failed')),
  });
}

export function useRecordPayment(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => billingApi.recordPayment(id, payload),
    onSuccess: () => {
      toast.success('Payment recorded');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Payment failed')),
  });
}
