import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissions';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';
import { DashboardsPanel } from '@/modules/reports/components/panels/DashboardsPanel';
import { ReportsCatalogPanel } from '@/modules/reports/components/panels/ReportsCatalogPanel';
import { AnalyticsPanel } from '@/modules/reports/components/panels/AnalyticsPanel';
import { ScheduledReportsPanel } from '@/modules/reports/components/panels/ScheduledReportsPanel';

/**
 * Single Reports & Analytics screen (client feedback: "too many pages").
 *
 * Replaces the hub-of-cards `ReportsHubPage` plus its pure-navigation targets
 * (`AnalyticsDashboardPage`, `ScheduledReportsPage`, `AnalyticsHomePage`,
 * `ExecutiveDashboardPage`) with four tabs on one route. The three screens that
 * take route params — `ReportViewerPage` (:type), `CategoryReportPage`
 * (:category) and `RoleDashboardPage` (:type) — stay their own routes and are
 * linked from the tabs.
 *
 * Tab state lives in `?tab=` so every tab is deep-linkable and bookmarkable.
 */
export default function ReportsWorkspacePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const canSchedule = hasAnyPermission(user?.permissions, [
    PERMISSIONS.REPORTS_SCHEDULE,
    PERMISSIONS.REPORTS_ALL,
  ]);

  const TABS = [
    { id: 'dashboards', label: t('reports.workspace.tabs.dashboards', 'Dashboards') },
    { id: 'reports', label: t('reports.workspace.tabs.reports', 'Reports') },
    { id: 'analytics', label: t('reports.workspace.tabs.analytics', 'Analytics') },
    ...(canSchedule
      ? [{ id: 'scheduled', label: t('reports.workspace.tabs.scheduled', 'Scheduled') }]
      : []),
  ];

  const requested = searchParams.get('tab');
  const tab = TABS.some((x) => x.id === requested) ? requested : 'dashboards';

  function selectTab(id) {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={t('reports.hubTitle', 'Reports & Analytics')}
        description={t(
          'reports.workspace.subtitle',
          'Dashboards, exports, live analytics and schedules — all on one screen.'
        )}
      />

      <div className="flex gap-2 overflow-x-auto border-b border-border pb-px">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => selectTab(tb.id)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              tab === tb.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'dashboards' && <DashboardsPanel />}
      {tab === 'reports' && <ReportsCatalogPanel />}
      {tab === 'analytics' && <AnalyticsPanel />}
      {tab === 'scheduled' && canSchedule && <ScheduledReportsPanel />}
    </section>
  );
}
