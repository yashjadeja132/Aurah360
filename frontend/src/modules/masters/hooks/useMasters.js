import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mastersApi } from '../api/mastersApi';
import { QUERY_KEYS } from '@/constants/queryKeys';

export function useMasterList(slug, params) {
  return useQuery({
    queryKey: QUERY_KEYS.MASTER_LIST(slug, params),
    queryFn: async () => {
      const res = await mastersApi.list(slug, params);
      return { items: res.data || [], meta: res.meta };
    },
    enabled: Boolean(slug),
    keepPreviousData: true,
  });
}

export function useMasterActive(slug, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.MASTER_ACTIVE(slug),
    queryFn: async () => {
      const res = await mastersApi.listActive(slug);
      return res.data || [];
    },
    enabled: Boolean(slug) && enabled,
  });
}

/** Dependency-warning check, run on demand right before a deactivate is confirmed. */
export function useMasterDependencies(slug) {
  return useMutation({
    mutationFn: (id) => mastersApi.checkDependencies(slug, id),
  });
}

export function useMasterMutations(slug) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['masters', slug] });

  return {
    create: useMutation({
      mutationFn: (payload) => mastersApi.create(slug, payload),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, payload }) => mastersApi.update(slug, id, payload),
      onSuccess: invalidate,
    }),
    activate: useMutation({
      mutationFn: (id) => mastersApi.activate(slug, id),
      onSuccess: invalidate,
    }),
    deactivate: useMutation({
      mutationFn: (id) => mastersApi.deactivate(slug, id),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id) => mastersApi.remove(slug, id),
      onSuccess: invalidate,
    }),
  };
}
