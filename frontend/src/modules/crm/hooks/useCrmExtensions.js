import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { crmExtensionsApi } from '../api/crmExtensionsApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

// --- Offers ---
export function useOffers(params = {}) {
  return useQuery({
    queryKey: ['crm-extensions', 'offers', params],
    queryFn: async () => (await crmExtensionsApi.listOffers(params)).data.offers || [],
  });
}

export function useCreateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => crmExtensionsApi.createOffer(payload),
    onSuccess: () => {
      toast.success('Offer created');
      qc.invalidateQueries({ queryKey: ['crm-extensions', 'offers'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not create offer')),
  });
}

export function useUpdateOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => crmExtensionsApi.updateOffer(id, payload),
    onSuccess: () => {
      toast.success('Offer updated');
      qc.invalidateQueries({ queryKey: ['crm-extensions', 'offers'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not update offer')),
  });
}

export function useApproveOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => crmExtensionsApi.approveOffer(id),
    onSuccess: () => {
      toast.success('Offer approved');
      qc.invalidateQueries({ queryKey: ['crm-extensions', 'offers'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not approve offer')),
  });
}

export function useRejectOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) => crmExtensionsApi.rejectOffer(id, { reason }),
    onSuccess: () => {
      toast.success('Offer rejected');
      qc.invalidateQueries({ queryKey: ['crm-extensions', 'offers'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not reject offer')),
  });
}

// --- Recall worklist ---
export function useRecallWorklist(params = {}) {
  return useQuery({
    queryKey: ['crm-extensions', 'recall', params],
    queryFn: async () => (await crmExtensionsApi.listRecallWorklist(params)).data.entries || [],
  });
}

export function useRecordRecallOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => crmExtensionsApi.recordRecallOutcome(id, payload),
    onSuccess: () => {
      toast.success('Outcome recorded');
      qc.invalidateQueries({ queryKey: ['crm-extensions', 'recall'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not record outcome')),
  });
}

// --- Feedback / NPS / complaints ---
export function useFeedbackList(params = {}) {
  return useQuery({
    queryKey: ['crm-extensions', 'feedback', params],
    queryFn: async () => (await crmExtensionsApi.listFeedback(params)).data.feedback || [],
  });
}

export function useEscalateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => crmExtensionsApi.escalateFeedback(id, payload),
    onSuccess: () => {
      toast.success('Escalated');
      qc.invalidateQueries({ queryKey: ['crm-extensions', 'feedback'] });
    },
  });
}

export function useResolveFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => crmExtensionsApi.resolveFeedback(id, payload),
    onSuccess: () => {
      toast.success('Marked resolved');
      qc.invalidateQueries({ queryKey: ['crm-extensions', 'feedback'] });
    },
  });
}

// --- Escalation inbox (free-text patient replies) ---
export function useEscalationTickets(params = {}) {
  return useQuery({
    queryKey: ['crm-extensions', 'escalation-tickets', params],
    queryFn: async () => (await crmExtensionsApi.listEscalationTickets(params)).data.tickets || [],
  });
}

export function useMarkEscalationTicketHandled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => crmExtensionsApi.markEscalationTicketHandled(id),
    onSuccess: () => {
      toast.success('Marked handled');
      qc.invalidateQueries({ queryKey: ['crm-extensions', 'escalation-tickets'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not mark handled')),
  });
}
