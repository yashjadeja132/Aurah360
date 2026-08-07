import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { privacyApi } from '../api/privacyApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

export function useBreakGlassGrants(params = {}) {
  return useQuery({
    queryKey: ['privacy', 'break-glass', params],
    queryFn: async () => (await privacyApi.listBreakGlassGrants(params)).data.grants || [],
  });
}

export function usePrivacyRequests(params = {}) {
  return useQuery({
    queryKey: ['privacy', 'requests', params],
    queryFn: async () => (await privacyApi.listRequests(params)).data.requests || [],
  });
}

export function useOpenPrivacyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => privacyApi.openRequest(payload),
    onSuccess: () => {
      toast.success('Privacy request opened');
      qc.invalidateQueries({ queryKey: ['privacy', 'requests'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not open request')),
  });
}

export function useVerifyIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => privacyApi.verifyIdentity(id),
    onSuccess: () => {
      toast.success('Identity verified');
      qc.invalidateQueries({ queryKey: ['privacy', 'requests'] });
    },
  });
}

export function useResolvePrivacyRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => privacyApi.resolveRequest(id, payload),
    onSuccess: () => {
      toast.success('Request resolved');
      qc.invalidateQueries({ queryKey: ['privacy', 'requests'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not resolve request')),
  });
}
