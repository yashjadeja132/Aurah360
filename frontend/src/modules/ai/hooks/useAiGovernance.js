import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { aiApi } from '../api/aiApi';

export function useAiRuns(params = {}) {
  return useQuery({
    queryKey: ['ai', 'runs', params],
    queryFn: async () => (await aiApi.listRuns(params)).data.runs || [],
  });
}

export function useAiGovernanceSummary() {
  return useQuery({
    queryKey: ['ai', 'governance-summary'],
    queryFn: async () => (await aiApi.governanceSummary()).data,
  });
}

export function useAiFeatureFlags() {
  return useQuery({
    queryKey: ['ai', 'feature-flags'],
    queryFn: async () => (await aiApi.listFeatureFlags()).data.flags || [],
  });
}

export function useSetAiFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ useCase, payload }) => aiApi.setFeatureFlag(useCase, payload),
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['ai', 'feature-flags'] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || 'Could not update'),
  });
}
