import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { crmApi } from '../api/crmApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

function invalidate(qc) {
  qc.invalidateQueries({ queryKey: ['crm'] });
}

export function useCrmDashboard() {
  return useQuery({
    queryKey: QUERY_KEYS.CRM_DASHBOARD(),
    queryFn: async () => (await crmApi.dashboard()).data,
  });
}

export function useLeads(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.CRM_LEADS(params),
    queryFn: async () => {
      const res = await crmApi.list(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function usePipeline() {
  return useQuery({
    queryKey: QUERY_KEYS.CRM_PIPELINE(),
    queryFn: async () => (await crmApi.pipeline()).data,
  });
}

export function useLead(id) {
  return useQuery({
    queryKey: QUERY_KEYS.CRM_LEAD(id),
    queryFn: async () => (await crmApi.getById(id)).data.lead,
    enabled: Boolean(id),
  });
}

export function useCrmTasks(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.CRM_TASKS(params),
    queryFn: async () => {
      const res = await crmApi.listTasks(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => crmApi.create(payload),
    onSuccess: () => {
      toast.success('Lead created');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Create failed')),
  });
}

export function useChangeLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, lostReason }) => crmApi.changeStatus(id, { status, lostReason }),
    onSuccess: () => {
      toast.success('Status updated');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Status change failed')),
  });
}

export function useAddFollowUp(leadId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => crmApi.addFollowUp(leadId, payload),
    onSuccess: () => {
      toast.success('Follow-up added');
      invalidate(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.CRM_LEAD(leadId) });
    },
    onError: (e) => toast.error(errMsg(e, 'Follow-up failed')),
  });
}

export function useConvertLead(leadId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => crmApi.convert(leadId, payload),
    onSuccess: () => {
      toast.success('Lead converted to patient');
      invalidate(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.CRM_LEAD(leadId) });
    },
    onError: (e) => toast.error(errMsg(e, 'Conversion failed')),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => crmApi.createTask(payload),
    onSuccess: () => {
      toast.success('Task created');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Task failed')),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => crmApi.updateTask(id, payload),
    onSuccess: () => {
      toast.success('Task updated');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Update failed')),
  });
}
