import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { treatmentSessionsApi } from '../api/treatmentSessionsApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

function invalidateAll(qc) {
  qc.invalidateQueries({ queryKey: ['treatment-sessions'] });
}

export function useSessionDashboard(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.TREATMENT_SESSION_DASHBOARD(params),
    queryFn: async () => {
      const res = await treatmentSessionsApi.dashboard(params);
      return res.data;
    },
  });
}

export function useSessions(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.TREATMENT_SESSION_LIST(params),
    queryFn: async () => {
      const res = await treatmentSessionsApi.list(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useSession(id) {
  return useQuery({
    queryKey: QUERY_KEYS.TREATMENT_SESSION_DETAIL(id),
    queryFn: async () => {
      const res = await treatmentSessionsApi.getById(id);
      return res.data.session;
    },
    enabled: Boolean(id),
  });
}

export function usePlanProgress(planId) {
  return useQuery({
    queryKey: QUERY_KEYS.TREATMENT_SESSION_PROGRESS(planId),
    queryFn: async () => {
      const res = await treatmentSessionsApi.progress(planId);
      return res.data.progress;
    },
    enabled: Boolean(planId),
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => treatmentSessionsApi.create(payload),
    onSuccess: () => {
      toast.success('Session created');
      invalidateAll(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Create failed')),
  });
}

export function useCheckInSession(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => treatmentSessionsApi.checkIn(id),
    onSuccess: () => {
      toast.success('Checked in');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_SESSION_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Check-in failed')),
  });
}

export function useStartSession(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => treatmentSessionsApi.start(id, payload),
    onSuccess: () => {
      toast.success('Session started');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_SESSION_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Start failed')),
  });
}

export function useCompleteSession(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => treatmentSessionsApi.complete(id, payload),
    onSuccess: () => {
      toast.success('Session completed');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_SESSION_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Complete failed')),
  });
}

export function useCancelSession(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => treatmentSessionsApi.cancel(id),
    onSuccess: () => {
      toast.success('Session cancelled');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_SESSION_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Cancel failed')),
  });
}

export function useSkipSession(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => treatmentSessionsApi.skip(id),
    onSuccess: () => {
      toast.success('Session skipped');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_SESSION_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Skip failed')),
  });
}

export function useRescheduleSession(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scheduledDate) => treatmentSessionsApi.reschedule(id, scheduledDate),
    onSuccess: () => {
      toast.success('Session rescheduled');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_SESSION_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Reschedule failed')),
  });
}

export function useUploadSessionPhoto(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, photoType }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('photoType', photoType);
      return treatmentSessionsApi.uploadPhoto(id, fd);
    },
    onSuccess: () => {
      toast.success('Photo uploaded');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.TREATMENT_SESSION_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Upload failed')),
  });
}
