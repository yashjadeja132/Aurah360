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

/** A.5 — pending discount approvals for an approver holding billing.discount_approve. */
export function useDiscountApprovalQueue(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.BILLING_DISCOUNT_APPROVALS(params),
    queryFn: async () => {
      const res = await billingApi.discountApprovalQueue(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useApproveDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decisionNote }) => billingApi.approveDiscount(id, decisionNote),
    onSuccess: () => {
      toast.success('Discount approved');
      invalidateAll(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Approve failed')),
  });
}

export function useRejectDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decisionNote }) => billingApi.rejectDiscount(id, decisionNote),
    onSuccess: () => {
      toast.success('Discount rejected');
      invalidateAll(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Reject failed')),
  });
}

/** A.4 — the cashier's due-payments worklist (oldest first, aging buckets in `meta`). */
export function useDuePayments(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.BILLING_DUE_PAYMENTS(params),
    queryFn: async () => {
      const res = await billingApi.duePayments(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

/**
 * A.8 — refund a recorded payment. `invoiceId` is only used to refresh that invoice's detail
 * view; the server keys everything off the payment.
 */
export function useRefundPayment(invoiceId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, ...payload }) => billingApi.refundPayment(paymentId, payload),
    onSuccess: () => {
      toast.success('Refund recorded');
      invalidateAll(qc);
      if (invoiceId) qc.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_DETAIL(invoiceId) });
    },
    onError: (e) => toast.error(errMsg(e, 'Refund failed')),
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
