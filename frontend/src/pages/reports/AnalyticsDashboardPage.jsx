import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { APP_ROUTES } from '@/constants/routes';
import { AnalyticsPanel } from '@/modules/reports/components/panels/AnalyticsPanel';

/**
 * Consolidated into `ReportsWorkspacePage` (`/reports?tab=analytics`).
 *
 * This file is now a thin shell over the shared `AnalyticsPanel` so there is a
 * single copy of the logic. It is kept because `routes/lazyPages.js` still
 * imports it; drop that import and this file once the workspace route lands.
 */
export default function AnalyticsDashboardPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('reports.analyticsDashboard.title', 'Analytics')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('reports.analyticsDashboard.subtitle', 'KPI cards and interactive trends across the clinic.')}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={APP_ROUTES.REPORTS}>{t('reports.reportsHub', 'Reports hub')}</Link>
        </Button>
      </div>

      <AnalyticsPanel />
    </section>
  );
}
