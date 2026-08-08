import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { APP_ROUTES } from '@/constants/routes';
import { ScheduledReportsPanel } from '@/modules/reports/components/panels/ScheduledReportsPanel';

/**
 * Consolidated into `ReportsWorkspacePage` (`/reports?tab=scheduled`).
 *
 * Thin shell over the shared `ScheduledReportsPanel` so there is a single copy
 * of the logic. Kept because `routes/lazyPages.js` still imports it.
 */
export default function ScheduledReportsPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('reports.scheduled.title', 'Scheduled reports')}
          </h1>
        </div>
        <Button asChild variant="outline">
          <Link to={APP_ROUTES.REPORTS}>{t('reports.hub', 'Hub')}</Link>
        </Button>
      </div>

      <ScheduledReportsPanel />
    </section>
  );
}
