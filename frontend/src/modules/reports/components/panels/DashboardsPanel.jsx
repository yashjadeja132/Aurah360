import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { APP_ROUTES } from '@/constants/routes';
import { DASHBOARD_TYPES } from '@/modules/reports/constants';
import { ExecutiveDashboardPanel } from './ExecutiveDashboardPanel';

/**
 * "Dashboards" tab of the Reports workspace: the executive KPI grid inline
 * (no navigation needed) plus the per-role dashboards, which stay their own
 * routes because they are parameterised by `:type`.
 */
export function DashboardsPanel() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-semibold">
          {t('reports.workspace.executiveSection', 'Executive snapshot')}
        </h2>
        <ExecutiveDashboardPanel />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{t('reports.dashboardsSection', 'Dashboards')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('reports.workspace.roleDashboardsHint', 'Per-role metric dashboards, each scoped to that team’s work.')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DASHBOARD_TYPES.map((d) => (
            <Link
              key={d.value}
              to={`${APP_ROUTES.REPORTS_DASHBOARDS}/${d.value}`}
              className="rounded-xl border bg-card p-4 transition hover:border-teal-700/40"
            >
              <p className="font-medium">{t(`reports.dashboardTypes.${d.value}`, d.label)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('reports.roleDashboardHint', 'Role dashboard')}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default DashboardsPanel;
