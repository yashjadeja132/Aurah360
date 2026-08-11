import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '../api/organizationApi';

export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const res = await organizationApi.get();
      return res.data.organization;
    },
  });
}

export function useOrganizationMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['organization'] });

  return {
    update: useMutation({ mutationFn: organizationApi.update, onSuccess: invalidate }),
  };
}
