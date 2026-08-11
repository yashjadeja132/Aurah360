import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { APP_ROUTES } from '@/constants/routes';
import { MyReportRunsPanel } from '@/modules/reports/components/panels/MyReportRunsPanel';

/**
 * Standalone route for the "my report runs" status page (also available as the workspace's
 * "My Runs" tab — `ReportsWorkspacePage`) — same shared panel, same pattern as
 * `ScheduledReportsPage`/`ScheduledReportsPanel`.
 */
export default function MyReportRunsPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('reports.runs.title', 'My report runs')}
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link to={APP_ROUTES.REPORTS}>{t('reports.hub', 'Hub')}</Link>
        </Button>
      </div>

      <MyReportRunsPanel />
    </section>
  );
}
