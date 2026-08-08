import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { reportsApi } from '../api/reportsApi';

/** Local-time `YYYY-MM-DD`, `offset` days from today. Avoids the UTC shift of toISOString(). */
export function isoDay(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function seriesValue(series, date, key = 'value') {
  const row = (series || []).find((s) => s.date === date);
  return Number(row?.[key] ?? 0);
}

/**
 * Yesterday-vs-today revenue / new patients / completed treatments, per branch.
 *
 * Reuses `GET /reports/analytics` — one request per branch over a two-day window.
 * That endpoint is the only existing one that honours BOTH `branchId` and
 * `dateFrom`/`dateTo` and returns per-day series, so the day-over-day comparison
 * is derived client-side from its `charts.*.series` arrays. No new backend
 * endpoint is needed.
 *
 * Deliberately NOT `GET /analytics/dashboard`: ExecutiveDashboardService
 * hard-codes today's date range and ignores dateFrom/dateTo, so it cannot
 * produce a "yesterday" figure. `GET /reports/dashboards/owner` likewise
 * hard-codes today + this-month.
 */
export function useOwnerBranchComparison(branches = []) {
  const today = isoDay(0);
  const yesterday = isoDay(-1);

  const queries = useQueries({
    queries: branches.map((b) => ({
      queryKey: ['reports', 'owner-landing', b.id, yesterday, today],
      queryFn: () =>
        reportsApi
          .analytics({ branchId: b.id, dateFrom: yesterday, dateTo: today })
          .then((r) => r.data),
      staleTime: 60_000,
      enabled: Boolean(b.id),
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  const error = queries.find((q) => q.isError)?.error;

  const rows = useMemo(
    () =>
      branches.map((b, i) => {
        const charts = queries[i]?.data?.charts || {};
        const rev = charts.revenueTrend?.series;
        const pat = charts.patientGrowth?.series;
        const tre = charts.treatmentCompletion?.series;
        return {
          branchId: b.id,
          name: b.name,
          branchCode: b.branchCode,
          revenue: { today: seriesValue(rev, today), yesterday: seriesValue(rev, yesterday) },
          patients: { today: seriesValue(pat, today), yesterday: seriesValue(pat, yesterday) },
          treatments: {
            today: seriesValue(tre, today, 'completed'),
            yesterday: seriesValue(tre, yesterday, 'completed'),
          },
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branches, queries.map((q) => q.dataUpdatedAt).join(','), today, yesterday]
  );

  const totals = useMemo(() => {
    const sum = (metric, day) => rows.reduce((acc, r) => acc + (r[metric]?.[day] || 0), 0);
    return {
      revenue: { today: sum('revenue', 'today'), yesterday: sum('revenue', 'yesterday') },
      patients: { today: sum('patients', 'today'), yesterday: sum('patients', 'yesterday') },
      treatments: { today: sum('treatments', 'today'), yesterday: sum('treatments', 'yesterday') },
    };
  }, [rows]);

  return { rows, totals, isLoading, isError, error, today, yesterday, refetchAll: () => queries.forEach((q) => q.refetch()) };
}

export default useOwnerBranchComparison;
