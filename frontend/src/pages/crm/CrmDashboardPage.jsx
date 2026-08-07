import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCrmDashboard } from '@/modules/crm/hooks/useCrm';
import { APP_ROUTES, leadDetailPath } from '@/constants/routes';

export default function CrmDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useCrmDashboard();
  const summary = data?.summary || {};
  const funnel = data?.funnel || {};
  const today = data?.todayFollowUps || [];
  const overdue = data?.overdue || [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('crm.dashboard.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('crm.dashboard.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.CRM_PIPELINE}>{t('crm.dashboard.kanban')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.CRM_LEADS}>{t('crm.dashboard.allLeads')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.CRM_TASKS}>{t('crm.dashboard.tasks')}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [t('crm.dashboard.totalLeads'), summary.total],
          [t('crm.dashboard.todayFollowUpsStat'), summary.todayFollowUps],
          [t('crm.dashboard.overdue'), summary.overdue],
          [t('crm.dashboard.conversionRate'), `${summary.conversionRate ?? 0}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{isLoading ? '—' : value ?? 0}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-2 font-semibold">{t('crm.dashboard.pipelineFunnel')}</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(funnel).map(([status, count]) => (
            <Badge key={status} variant="outline">
              {t(`crm.leadStatus.${status}`, status)}: {count}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <h2 className="font-semibold">{t('crm.dashboard.todaysFollowUps')}</h2>
          {today.map((l) => (
            <Link
              key={l.id}
              to={leadDetailPath(l.id)}
              className="block rounded-xl border p-3 hover:bg-muted/40"
            >
              <p className="font-medium">
                {l.fullName} · {l.leadNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                {l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleString() : '—'}
              </p>
            </Link>
          ))}
          {!today.length && !isLoading && (
            <p className="text-sm text-muted-foreground">{t('crm.dashboard.noneToday')}</p>
          )}
        </div>
        <div className="space-y-2">
          <h2 className="font-semibold">{t('crm.dashboard.overdue')}</h2>
          {overdue.map((l) => (
            <Link
              key={l.id}
              to={leadDetailPath(l.id)}
              className="block rounded-xl border border-destructive/30 p-3"
            >
              <p className="font-medium">
                {l.fullName} · {l.leadNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                {l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleString() : '—'}
              </p>
            </Link>
          ))}
          {!overdue.length && !isLoading && (
            <p className="text-sm text-muted-foreground">{t('crm.dashboard.noOverdue')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
