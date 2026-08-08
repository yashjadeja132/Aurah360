import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { APP_ROUTES } from '@/constants/routes';
import { CrmOverviewPanel } from '@/modules/crm/components/CrmOverviewPanel';

/**
 * DEPRECATED — superseded by CrmHubPage (`/crm` with ?tab=overview).
 * Thin wrapper around the shared panel so the legacy route keeps working until
 * the hub wiring lands; delete once the route is removed.
 */
export default function CrmDashboardPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('crm.dashboard.title', 'CRM')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('crm.dashboard.subtitle', 'Lead funnel and follow-ups')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.CRM_PIPELINE}>{t('crm.dashboard.kanban', 'Kanban')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.CRM_LEADS}>{t('crm.dashboard.allLeads', 'All leads')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.CRM_TASKS}>{t('crm.dashboard.tasks', 'Tasks')}</Link>
          </Button>
        </div>
      </div>
      <CrmOverviewPanel />
    </section>
  );
}
