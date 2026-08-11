import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { notificationsApi } from '../api/notificationsApi';
import { consentApi } from '@/modules/reception/api/consentApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

function invalidate(qc) {
  qc.invalidateQueries({ queryKey: ['notifications'] });
}

export function useNotifications(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS_LIST(params),
    queryFn: async () => {
      const res = await notificationsApi.list(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useInbox(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS_INBOX(params),
    queryFn: async () => {
      const res = await notificationsApi.inbox(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useUnreadCount(options = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS_UNREAD(),
    queryFn: async () => (await notificationsApi.unreadCount()).data?.count ?? 0,
    refetchInterval: 30000,
    ...options,
  });
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS_TEMPLATES(),
    queryFn: async () => {
      const res = await notificationsApi.listTemplates();
      return res.data || [];
    },
  });
}

export function useProviderStatus() {
  return useQuery({
    queryKey: ['notifications', 'provider-status'],
    queryFn: async () => (await notificationsApi.providerStatus()).data?.status,
    staleTime: 60000,
  });
}

export function useNotificationReports() {
  return useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS_REPORTS(),
    queryFn: async () => (await notificationsApi.reports()).data,
  });
}

/**
 * Consent categories (Communications → Consent categories). Reuses the existing
 * GET /consent/definitions endpoint — read-only list of published consent
 * purposes/versions, no new backend surface.
 */
export function useConsentDefinitions() {
  return useQuery({
    queryKey: ['consent', 'definitions'],
    queryFn: async () => (await consentApi.listDefinitions())?.data?.definitions || [],
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => notificationsApi.markRead(id),
    onSuccess: () => invalidate(qc),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      toast.success('All marked read');
      invalidate(qc);
    },
  });
}

export function useRetryNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => notificationsApi.retry(id),
    onSuccess: () => {
      toast.success('Retry queued');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Retry failed')),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => notificationsApi.updateTemplate(id, payload),
    onSuccess: () => {
      toast.success('Template updated');
      invalidate(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Update failed')),
  });
}
