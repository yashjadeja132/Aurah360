import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { APP_ROUTES } from '@/constants/routes';
import { REPORT_TYPES } from '@/modules/reports/constants';
import { ANALYTICS_CATEGORIES } from '@/modules/analytics/constants';

/**
 * "Reports" tab of the Reports workspace — the catalogue of everything that
 * opens a parameterised detail route. Absorbs the card grids that used to be
 * `ReportsHubPage` (tabular reports) and `AnalyticsHomePage` (categories),
 * so those two pure-navigation screens are no longer needed.
 */
export function ReportsCatalogPanel() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-semibold">{t('reports.tabularReportsSection', 'Tabular reports')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('reports.workspace.tabularHint', 'Row-level exports with saved filters — opens the report viewer.')}
        </p>
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
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">
          {t('reports.workspace.categorySection', 'Category reports')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('analytics.categoryCardHint', 'Charts · filters · export')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ANALYTICS_CATEGORIES.map((c) => (
            <Link
              key={c.value}
              to={`${APP_ROUTES.ANALYTICS}/${c.path}`}
              className="rounded-xl border bg-card p-4 transition hover:border-teal-700/40"
            >
              <p className="font-medium">{t(`analytics.categories.${c.value}`, c.label)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('analytics.categoryCardHint', 'Charts · filters · export')}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">
          {t('reports.workspace.governanceSection', 'Governance & compliance')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            'reports.workspace.governanceSectionHint',
            'These live on their own dedicated screens rather than the tabular exporter — linked here so the catalogue stays a single starting point.'
          )}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Link to={APP_ROUTES.NOTIFICATIONS + '?tab=log'} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/40">
            {t('reports.governanceLinks.communications', 'Communications delivery log')}
          </Link>
          <Link to={APP_ROUTES.SETTINGS_AI_GOVERNANCE} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/40">
            {t('reports.governanceLinks.aiGovernance', 'AI governance')}
          </Link>
          <Link to={APP_ROUTES.SETTINGS_AUDIT_LOG} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted/40">
            {t('reports.governanceLinks.securityAudit', 'Security / audit log')}
          </Link>
        </div>
      </section>
    </div>
  );
}

export default ReportsCatalogPanel;
