import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCrmDashboard } from '@/modules/crm/hooks/useCrm';
import { leadDetailPath } from '@/constants/routes';

/**
 * CRM funnel/KPI overview (was CrmDashboardPage body). The old quick-nav buttons
 * pointed at the Kanban/Leads/Tasks routes; inside the hub they become tab
 * switches via `onNavigateTab`, and Offers/Recalls/Feedback — previously
 * sidebar-only — are now part of the same jumping-off strip.
 */
export function CrmOverviewPanel({ onNavigateTab, availableTabs = [] }) {
  const { t } = useTranslation();
  const { data, isLoading } = useCrmDashboard();
  const summary = data?.summary || {};
  const funnel = data?.funnel || {};
  const today = data?.todayFollowUps || [];
  const overdue = data?.overdue || [];

  const shortcuts = [
    { id: 'pipeline', label: t('crm.dashboard.kanban', 'Kanban') },
    { id: 'leads', label: t('crm.dashboard.allLeads', 'All leads') },
    { id: 'followups', label: t('crm.dashboard.tasks', 'Tasks') },
    { id: 'recalls', label: t('crm.hub.tabs.recalls', 'Recalls') },
    { id: 'offers', label: t('crm.hub.tabs.offers', 'Offers') },
    { id: 'feedback', label: t('crm.hub.tabs.feedback', 'Feedback') },
  ].filter((s) => availableTabs.includes(s.id));

  return (
    <div className="space-y-6">
      {onNavigateTab && shortcuts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {shortcuts.map((s) => (
            <Button key={s.id} variant="outline" onClick={() => onNavigateTab(s.id)}>
              {s.label}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [t('crm.dashboard.totalLeads', 'Total leads'), summary.total],
          [t('crm.dashboard.todayFollowUpsStat', "Today's follow-ups"), summary.todayFollowUps],
          [t('crm.dashboard.overdue', 'Overdue'), summary.overdue],
          [t('crm.dashboard.conversionRate', 'Conversion rate'), `${summary.conversionRate ?? 0}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{isLoading ? '—' : value ?? 0}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-2 font-semibold">{t('crm.dashboard.pipelineFunnel', 'Pipeline funnel')}</h2>
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
          <h2 className="font-semibold">{t('crm.dashboard.todaysFollowUps', "Today's follow-ups")}</h2>
          {today.map((l) => (
            <Link key={l.id} to={leadDetailPath(l.id)} className="block rounded-xl border p-3 hover:bg-muted/40">
              <p className="font-medium">
                {l.fullName} · {l.leadNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                {l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleString() : '—'}
              </p>
            </Link>
          ))}
          {!today.length && !isLoading && (
            <p className="text-sm text-muted-foreground">{t('crm.dashboard.noneToday', 'Nothing due today.')}</p>
          )}
        </div>
        <div className="space-y-2">
          <h2 className="font-semibold">{t('crm.dashboard.overdue', 'Overdue')}</h2>
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
            <p className="text-sm text-muted-foreground">{t('crm.dashboard.noOverdue', 'Nothing overdue.')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default CrmOverviewPanel;
