import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { branchesApi } from '../api/branchesApi';
import { QUERY_KEYS } from '@/constants/queryKeys';

export function useBranchList(params) {
  return useQuery({
    queryKey: QUERY_KEYS.BRANCH_LIST(params),
    queryFn: async () => {
      const res = await branchesApi.list(params);
      return { items: res.data || [], meta: res.meta };
    },
    keepPreviousData: true,
  });
}

export function useBranchDetail(id) {
  return useQuery({
    queryKey: QUERY_KEYS.BRANCH_DETAIL(id),
    queryFn: async () => {
      const res = await branchesApi.getById(id);
      return res.data.branch;
    },
    enabled: Boolean(id),
  });
}

export function useBranchMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['branches'] });

  return {
    create: useMutation({ mutationFn: branchesApi.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, payload }) => branchesApi.update(id, payload),
      onSuccess: invalidate,
    }),
    updateSettings: useMutation({
      mutationFn: ({ id, payload }) => branchesApi.updateSettings(id, payload),
      onSuccess: invalidate,
    }),
    activate: useMutation({ mutationFn: branchesApi.activate, onSuccess: invalidate }),
    deactivate: useMutation({ mutationFn: branchesApi.deactivate, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: branchesApi.remove, onSuccess: invalidate }),
  };
}
