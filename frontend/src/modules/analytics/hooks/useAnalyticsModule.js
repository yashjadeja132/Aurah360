import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analyticsApi';
import { QUERY_KEYS } from '@/constants/queryKeys';

export function useExecutiveDashboard(params) {
  return useQuery({
    queryKey: QUERY_KEYS.ANALYTICS_DASHBOARD(params),
    queryFn: () => analyticsApi.dashboard(params).then((r) => r.data),
  });
}

export function useAnalyticsCategory(category, params) {
  return useQuery({
    queryKey: QUERY_KEYS.ANALYTICS_REPORT(category, params),
    queryFn: () => analyticsApi.report(category, params).then((r) => r.data),
    enabled: Boolean(category),
  });
}
