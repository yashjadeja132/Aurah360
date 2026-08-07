import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAnalyticsCategory } from '@/modules/analytics/hooks/useAnalyticsModule';
import { AnalyticsFilters } from '@/modules/analytics/components/AnalyticsFilters';
import { ExportButtons } from '@/modules/analytics/components/ExportButtons';
import {
  AnalyticsLineChart,
  AnalyticsBarChart,
  AnalyticsAreaChart,
  AnalyticsPieChart,
  HeatmapPlaceholder,
} from '@/modules/analytics/components/charts/ChartKit';
import { ANALYTICS_CATEGORIES, money } from '@/modules/analytics/constants';
import { APP_ROUTES } from '@/constants/routes';

export default function CategoryReportPage() {
  const { t } = useTranslation();
  const { category } = useParams();
  const meta = ANALYTICS_CATEGORIES.find((c) => c.value === category);
  const categoryLabel = meta ? t(`analytics.categories.${meta.value}`, meta.label) : '';
  const [draft, setDraft] = useState({ period: 'monthly' });
  const [filters, setFilters] = useState({ period: 'monthly' });
  const { data, isLoading, isError, error } = useAnalyticsCategory(category, filters);

  const summaryEntries = useMemo(
    () => Object.entries(data?.summary || {}).slice(0, 8),
    [data]
  );

  if (!meta) {
    return <p className="text-sm text-muted-foreground">{t('analytics.unknownCategory', 'Unknown report category.')}</p>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('analytics.categoryReportsTitle', '{{category}} reports', { category: categoryLabel })}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading ? t('analytics.loading', 'Loading…') : t('analytics.aggregatedFrom', 'Aggregated from clinic modules')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.ANALYTICS}>{t('analytics.home', 'Home')}</Link>
          </Button>
          {category !== 'ai' && <ExportButtons category={category} filters={filters} />}
        </div>
      </div>

      {category !== 'ai' && (
        <AnalyticsFilters
          value={draft}
          onChange={setDraft}
          onApply={() => setFilters({ ...draft })}
        />
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/40 p-4 text-sm">
          {error?.message || t('analytics.failedToLoad', 'Failed to load report')}
        </div>
      )}

      {data?.placeholder && (
        <div className="rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground">
          {data.message}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryEntries.map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-card p-4">
            <p className="text-xs capitalize text-muted-foreground">{k.replace(/([A-Z])/g, ' $1')}</p>
            <p className="mt-1 text-xl font-semibold">
              {typeof v === 'number' && /revenue|amount|collections|cash|value/i.test(k)
                ? money(v)
                : String(v)}
            </p>
          </div>
        ))}
        {!summaryEntries.length && !isLoading && (
          <p className="text-sm text-muted-foreground">{t('analytics.noSummaryMetrics', 'No summary metrics.')}</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data?.trend && (
          <AnalyticsLineChart title={t('analytics.charts.trend', 'Trend')} data={data.trend} dataKey="count" />
        )}
        {data?.revenueTrend && (
          <AnalyticsAreaChart title={t('analytics.charts.revenueTrend', 'Revenue trend')} data={data.revenueTrend} />
        )}
        {data?.growth && (
          <AnalyticsAreaChart title={t('analytics.charts.patientGrowth', 'Patient growth')} data={data.growth} />
        )}
        {data?.byStatus && (
          <AnalyticsPieChart
            title={t('analytics.charts.byStatus', 'By status')}
            donut
            data={data.byStatus.map((s) => ({ name: s.status, value: s.count }))}
          />
        )}
        {data?.genderDistribution && (
          <AnalyticsPieChart
            title={t('analytics.charts.gender', 'Gender')}
            data={data.genderDistribution.map((g) => ({ name: g.gender, value: g.count }))}
          />
        )}
        {data?.paymentMethods && (
          <AnalyticsBarChart
            title={t('analytics.charts.paymentMethods', 'Payment methods')}
            data={data.paymentMethods.map((m) => ({ label: m.method, count: m.amount }))}
            dataKey="count"
          />
        )}
        {data?.leadSources && (
          <AnalyticsBarChart
            title={t('analytics.charts.leadSources', 'Lead sources')}
            data={data.leadSources.map((s) => ({ label: s.source, count: s.total }))}
          />
        )}
        {data?.stockMovement && (
          <AnalyticsBarChart
            title={t('analytics.charts.stockMovement', 'Stock movement')}
            data={data.stockMovement.map((s) => ({ label: s.type, count: s.quantity }))}
          />
        )}
        <HeatmapPlaceholder title={t('analytics.charts.heatMap', '{{category}} heat map', { category: categoryLabel })} />
      </div>

      {data?.rows?.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                {(data.columns || []).map((c) => (
                  <th key={c.key} className="px-3 py-2 font-medium">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-t">
                  {(data.columns || []).map((c) => (
                    <td key={c.key} className="px-3 py-2 text-muted-foreground">
                      {row[c.key] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
