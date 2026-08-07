import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { APP_ROUTES } from '@/constants/routes';
import { DASHBOARD_TYPES, REPORT_TYPES } from '@/modules/reports/constants';

export default function ReportsHubPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('reports.hubTitle', 'Reports & Analytics')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('reports.hubSubtitle', 'Centralized dashboards and exports across clinic modules.')}
        </p>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">{t('reports.dashboardsSection', 'Dashboards')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DASHBOARD_TYPES.map((d) => (
            <Link
              key={d.value}
              to={`${APP_ROUTES.REPORTS_DASHBOARDS}/${d.value}`}
              className="rounded-xl border bg-card p-4 transition hover:border-teal-700/40"
            >
              <p className="font-medium">{t(`reports.dashboardTypes.${d.value}`, d.label)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t('reports.roleDashboardHint', 'Role dashboard')}</p>
            </Link>
          ))}
          <Link
            to={APP_ROUTES.REPORTS_ANALYTICS}
            className="rounded-xl border bg-card p-4 transition hover:border-teal-700/40"
          >
            <p className="font-medium">{t('reports.analyticsDashboard.title', 'Analytics')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('reports.analyticsCardHint', 'KPIs & trend charts')}</p>
          </Link>
          <Link
            to={APP_ROUTES.REPORTS_SCHEDULED}
            className="rounded-xl border bg-card p-4 transition hover:border-teal-700/40"
          >
            <p className="font-medium">{t('reports.scheduled.title', 'Scheduled reports')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('reports.scheduledCardHint', 'Daily / weekly / monthly')}</p>
          </Link>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">{t('reports.tabularReportsSection', 'Tabular reports')}</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {REPORT_TYPES.map((r) => (
            <Link
              key={r.value}
              to={`${APP_ROUTES.REPORTS_VIEWER}/${r.value}`}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
            >
              {t(`reports.reportTypes.${r.value}`, r.label)}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
