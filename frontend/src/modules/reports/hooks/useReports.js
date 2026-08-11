import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { reportsApi } from '../api/reportsApi';

export function useReportDashboard(type, params) {
  return useQuery({
    queryKey: QUERY_KEYS.REPORTS_DASHBOARD(type, params),
    queryFn: () => reportsApi.dashboard(type, params).then((r) => r.data),
    enabled: Boolean(type),
  });
}

export function useAnalytics(params) {
  return useQuery({
    queryKey: QUERY_KEYS.REPORTS_ANALYTICS(params),
    queryFn: () => reportsApi.analytics(params).then((r) => r.data),
  });
}

export function useReportGenerate(type, params, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.REPORTS_GENERATE(type, params),
    queryFn: () => reportsApi.generate(type, params).then((r) => r.data),
    enabled: Boolean(type) && enabled,
  });
}

export function useScheduledReports() {
  return useQuery({
    queryKey: QUERY_KEYS.REPORTS_SCHEDULED(),
    queryFn: () => reportsApi.listScheduled().then((r) => r.data),
  });
}

export function useCreateScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => reportsApi.createScheduled(payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });
}

export function useDeleteScheduledReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => reportsApi.deleteScheduled(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  });
}

/** "My report runs" status list — polls every 10s so a QUEUED/RUNNING async export flips to
 *  COMPLETED (or FAILED) on this page without the user having to manually refresh. */
export function useReportRuns() {
  return useQuery({
    queryKey: QUERY_KEYS.REPORTS_RUNS(),
    queryFn: () => reportsApi.listRuns().then((r) => r.data),
    refetchInterval: 10_000,
  });
}

export function useSavedFilters(scope) {
  return useQuery({
    queryKey: QUERY_KEYS.REPORTS_SAVED_FILTERS(scope),
    queryFn: () => reportsApi.listSavedFilters({ scope }).then((r) => r.data),
  });
}

export function useSaveReportFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => reportsApi.saveFilter(payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports', 'saved-filters'] }),
  });
}
