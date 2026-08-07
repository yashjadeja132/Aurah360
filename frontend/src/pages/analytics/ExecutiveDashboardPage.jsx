import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useExecutiveDashboard } from '@/modules/analytics/hooks/useAnalyticsModule';
import { AnalyticsFilters } from '@/modules/analytics/components/AnalyticsFilters';
import { money } from '@/modules/analytics/constants';
import { APP_ROUTES } from '@/constants/routes';

function Kpi({ label, value, loading }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{loading ? '…' : value ?? 0}</p>
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState({ period: 'daily' });
  const [filters, setFilters] = useState({});
  const { data, isLoading, isError, error, refetch, isFetching } = useExecutiveDashboard(filters);
  const w = data?.widgets || {};

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('analytics.executiveDashboard.title', 'Executive dashboard')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('analytics.executiveDashboard.liveClinicKpis', "Live clinic KPIs")}
            {data?.cached ? ` · ${t('analytics.executiveDashboard.cached', 'cached')}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.ANALYTICS}>{t('analytics.allAnalytics', 'All analytics')}</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {t('analytics.refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      <AnalyticsFilters
        value={draft}
        onChange={setDraft}
        onApply={() => setFilters({ ...draft })}
        showPeriod={false}
      />

      {isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          {error?.message || t('analytics.executiveDashboard.failedToLoad', 'Failed to load dashboard')}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={t('analytics.executiveDashboard.kpis.todaysAppointments', "Today's appointments")} value={w.todaysAppointments} loading={isLoading} />
        <Kpi label={t('analytics.executiveDashboard.kpis.todaysRevenue', "Today's revenue")} value={money(w.todaysRevenue)} loading={isLoading} />
        <Kpi label={t('analytics.executiveDashboard.kpis.todaysCollections', "Today's collections")} value={money(w.todaysCollections)} loading={isLoading} />
        <Kpi label={t('analytics.executiveDashboard.kpis.pendingPayments', 'Pending payments')} value={money(w.pendingPayments)} loading={isLoading} />
        <Kpi label={t('analytics.executiveDashboard.kpis.registeredToday', 'Registered today')} value={w.patientsRegisteredToday} loading={isLoading} />
        <Kpi label={t('analytics.executiveDashboard.kpis.newPatients', 'New patients')} value={w.newPatients} loading={isLoading} />
        <Kpi label={t('analytics.executiveDashboard.kpis.returningPatients', 'Returning patients')} value={w.returningPatients} loading={isLoading} />
        <Kpi label={t('analytics.executiveDashboard.kpis.activeTreatments', 'Active treatments')} value={w.activeTreatments} loading={isLoading} />
        <Kpi label={t('analytics.executiveDashboard.kpis.completedTreatments', 'Completed treatments')} value={w.completedTreatments} loading={isLoading} />
        <Kpi label={t('analytics.executiveDashboard.kpis.doctorsAvailable', 'Doctors available')} value={w.doctorsAvailableToday} loading={isLoading} />
        <Kpi label={t('analytics.executiveDashboard.kpis.waitingQueue', 'Waiting queue')} value={w.waitingQueue} loading={isLoading} />
        <Kpi label={t('analytics.executiveDashboard.kpis.cancelled', 'Cancelled')} value={w.cancelledAppointments} loading={isLoading} />
        <Kpi label={t('analytics.executiveDashboard.kpis.noShows', 'No shows')} value={w.noShows} loading={isLoading} />
        <Kpi label={t('analytics.executiveDashboard.kpis.feedbackRating', 'Feedback rating')} value={w.feedbackRating} loading={isLoading} />
      </div>
    </section>
  );
}
