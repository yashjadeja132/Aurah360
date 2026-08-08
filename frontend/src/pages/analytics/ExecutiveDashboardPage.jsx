import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { APP_ROUTES } from '@/constants/routes';
import { ExecutiveDashboardPanel } from '@/modules/reports/components/panels/ExecutiveDashboardPanel';

/**
 * Consolidated into `ReportsWorkspacePage` (`/reports?tab=dashboards`).
 *
 * Thin shell over the shared `ExecutiveDashboardPanel` so there is a single
 * copy of the logic. Kept because `routes/lazyPages.js` still imports it.
 */
export default function ExecutiveDashboardPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('analytics.executiveDashboard.title', 'Executive dashboard')}
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link to={APP_ROUTES.REPORTS}>{t('reports.hub', 'Hub')}</Link>
        </Button>
      </div>

      <ExecutiveDashboardPanel />
    </section>
  );
}
