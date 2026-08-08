import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAnalytics, useSaveReportFilter, useSavedFilters } from '@/modules/reports/hooks/useReports';
import { KpiCard } from '@/modules/reports/components/KpiCard';
import { ReportFilters } from '@/modules/reports/components/ReportFilters';
import { TrendChart, FunnelChart } from '@/modules/reports/components/TrendChart';
import { formatMoney } from '@/modules/reports/constants';

/**
 * KPI cards + trend charts from `GET /reports/analytics`.
 * Logic moved out of `pages/reports/AnalyticsDashboardPage` so the workspace
 * "Analytics" tab and the standalone page render the same component.
 */
export function AnalyticsPanel() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({});
  const [filters, setFilters] = useState({});
  const { data, isLoading } = useAnalytics(filters);
  const { data: saved = [] } = useSavedFilters('analytics');
  const saveFilter = useSaveReportFilter();

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};

  return (
    <div className="space-y-4">
      <ReportFilters
        value={draft}
        onChange={setDraft}
        onApply={() => setFilters({ ...draft })}
        savedFilters={saved}
        onLoadSaved={(f) => {
          setDraft(f.filters || {});
          setFilters(f.filters || {});
        }}
        onSave={async () => {
          const name = window.prompt(t('reports.filterNamePrompt', 'Filter name'));
          if (!name) return;
          try {
            await saveFilter.mutateAsync({ name, scope: 'analytics', filters: draft });
            toast.success(t('reports.filterSaved', 'Filter saved'));
          } catch (err) {
            toast.error(err.message || t('reports.saveFailed', 'Save failed'));
          }
        }}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label={t('reports.analyticsDashboard.kpis.averageConsultationTime', 'Avg consultation (min)')} value={isLoading ? '…' : kpis.averageConsultationTime} />
        <KpiCard label={t('reports.analyticsDashboard.kpis.averageWaitTime', 'Avg wait (min)')} value={isLoading ? '…' : kpis.averageWaitTime} />
        <KpiCard
          label={t('reports.analyticsDashboard.kpis.averageRevenuePerPatient', 'Avg revenue / patient')}
          value={isLoading ? '…' : formatMoney(kpis.averageRevenuePerPatient)}
        />
        <KpiCard label={t('reports.analyticsDashboard.kpis.treatmentCompletionPercent', 'Treatment completion %')} value={isLoading ? '…' : `${kpis.treatmentCompletionPercent ?? 0}%`} />
        <KpiCard label={t('reports.analyticsDashboard.kpis.conversionPercent', 'Conversion %')} value={isLoading ? '…' : `${kpis.conversionPercent ?? 0}%`} />
        <KpiCard label={t('reports.analyticsDashboard.kpis.noShowPercent', 'No-show %')} value={isLoading ? '…' : `${kpis.noShowPercent ?? 0}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart title={t('reports.analyticsDashboard.charts.revenueTrend', 'Revenue trend')} data={charts.revenueTrend?.series || []} color="#0f766e" />
        <TrendChart
          title={t('reports.analyticsDashboard.charts.appointmentsTrend', 'Appointments trend')}
          data={charts.appointmentsTrend?.series || []}
          type="bar"
          color="#1d4ed8"
        />
        <FunnelChart title={t('reports.analyticsDashboard.charts.leadFunnel', 'Lead funnel')} data={charts.leadFunnel?.series || []} />
        <TrendChart title={t('reports.analyticsDashboard.charts.patientGrowth', 'Patient growth')} data={charts.patientGrowth?.series || []} color="#b45309" />
        <TrendChart
          title={t('reports.analyticsDashboard.charts.inventoryMovements', 'Inventory movements')}
          data={charts.inventoryTrend?.series || []}
          type="bar"
          color="#7c3aed"
        />
        <TrendChart
          title={t('reports.analyticsDashboard.charts.treatmentCompletion', 'Treatment completion %')}
          data={charts.treatmentCompletion?.series || []}
          color="#be123c"
        />
      </div>
    </div>
  );
}

export default AnalyticsPanel;
