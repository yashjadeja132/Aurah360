import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../api/auditApi';

/** Only fetches once `enabled` filters are provided by the caller's gate (search button). */
export function useAuditSearch(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['audit', 'entries', params],
    queryFn: async () => (await auditApi.search(params)).data,
    enabled,
    keepPreviousData: true,
  });
}

export default useAuditSearch;
