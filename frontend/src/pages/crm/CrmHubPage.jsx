import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissions';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';
import { CrmOverviewPanel } from '@/modules/crm/components/CrmOverviewPanel';
import { CrmLeadsPanel } from '@/modules/crm/components/CrmLeadsPanel';
import { CrmPipelinePanel } from '@/modules/crm/components/CrmPipelinePanel';
import { CrmFollowUpsPanel } from '@/modules/crm/components/CrmFollowUpsPanel';
import { CrmRecallPanel } from '@/modules/crm/components/CrmRecallPanel';
import { CrmOffersPanel } from '@/modules/crm/components/CrmOffersPanel';
import { CrmFeedbackPanel } from '@/modules/crm/components/CrmFeedbackPanel';
import { NotificationDeliveryLogPanel } from '@/modules/notifications/components/NotificationDeliveryLogPanel';

/**
 * Gates carried over from the routes each panel used to live behind: the lead
 * pipeline pages were all wrapped in CrmPermission (crm.view), while Recall,
 * Offers and Feedback have their own dedicated permissions matching the
 * /crm-extensions endpoints they call.
 */
const CORE_PERMS = [PERMISSIONS.CRM_VIEW, PERMISSIONS.CRM_ALL];
const RECALL_PERMS = [PERMISSIONS.CRM_RECALL, PERMISSIONS.CRM_ALL];
const OFFERS_PERMS = [
  PERMISSIONS.CRM_OFFERS_VIEW,
  PERMISSIONS.CRM_OFFERS_MANAGE,
  PERMISSIONS.CRM_ALL,
];
const FEEDBACK_PERMS = [PERMISSIONS.CRM_FEEDBACK_VIEW, PERMISSIONS.CRM_ALL];
// Spec §3 "Reminders" — delivery status (sent/delivered/read/failed) + retry, reusing the
// notifications module's own log panel rather than duplicating it inside CRM.
const REMINDERS_PERMS = [
  PERMISSIONS.NOTIFICATIONS_VIEW,
  PERMISSIONS.NOTIFICATIONS_MANAGE,
  PERMISSIONS.NOTIFICATIONS_ALL,
  PERMISSIONS.CRM_ALL,
];

/** Union of every tab gate — what it takes to see the hub at all. */
export const CRM_HUB_PERMISSIONS = [
  ...new Set([
    ...CORE_PERMS,
    ...RECALL_PERMS,
    ...OFFERS_PERMS,
    ...FEEDBACK_PERMS,
    ...REMINDERS_PERMS,
  ]),
];

/**
 * Single CRM screen. CrmDashboardPage was already a partial hub (KPIs, funnel,
 * quick-nav to Kanban/Leads/Tasks); this extends that idea into one route with
 * client-side tabs and folds in Offers, Recalls and Feedback, which previously
 * had to be reached from the sidebar. Lead DETAIL stays its own route — it is a
 * record, not a tab.
 */
export default function CrmHubPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const perms = user?.permissions;

  const canViewCore = hasAnyPermission(perms, CORE_PERMS);
  const canViewRecalls = hasAnyPermission(perms, RECALL_PERMS);
  const canViewOffers = hasAnyPermission(perms, OFFERS_PERMS);
  const canViewFeedback = hasAnyPermission(perms, FEEDBACK_PERMS);
  const canViewReminders = hasAnyPermission(perms, REMINDERS_PERMS);

  const TABS = useMemo(
    () => [
      ...(canViewCore
        ? [
            { id: 'overview', label: t('crm.hub.tabs.overview', 'Overview') },
            { id: 'leads', label: t('crm.hub.tabs.leads', 'Leads') },
            { id: 'pipeline', label: t('crm.hub.tabs.pipeline', 'Pipeline') },
            { id: 'followups', label: t('crm.hub.tabs.followups', 'Follow-ups') },
          ]
        : []),
      ...(canViewRecalls ? [{ id: 'recalls', label: t('crm.hub.tabs.recalls', 'Recalls') }] : []),
      ...(canViewReminders ? [{ id: 'reminders', label: t('crm.hub.tabs.reminders', 'Reminders') }] : []),
      ...(canViewOffers ? [{ id: 'offers', label: t('crm.hub.tabs.offers', 'Offers') }] : []),
      ...(canViewFeedback ? [{ id: 'feedback', label: t('crm.hub.tabs.feedback', 'Feedback') }] : []),
    ],
    [t, canViewCore, canViewRecalls, canViewReminders, canViewOffers, canViewFeedback]
  );

  const requested = searchParams.get('tab');
  const tab = TABS.some((tb) => tb.id === requested) ? requested : TABS[0]?.id;

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  return (
    <PermissionGuard permissions={CRM_HUB_PERMISSIONS} fallback="redirect">
      <section className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('crm.dashboard.title', 'CRM')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'crm.hub.subtitle',
              'Leads, follow-ups, recalls, offers and patient feedback in one place'
            )}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-border pb-px">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={cn(
                'border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                tab === tb.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <PermissionGuard permissions={CORE_PERMS}>
            <CrmOverviewPanel onNavigateTab={setTab} availableTabs={TABS.map((tb) => tb.id)} />
          </PermissionGuard>
        )}
        {tab === 'leads' && (
          <PermissionGuard permissions={CORE_PERMS}>
            <CrmLeadsPanel />
          </PermissionGuard>
        )}
        {tab === 'pipeline' && (
          <PermissionGuard permissions={CORE_PERMS}>
            <CrmPipelinePanel />
          </PermissionGuard>
        )}
        {tab === 'followups' && (
          <PermissionGuard permissions={CORE_PERMS}>
            <CrmFollowUpsPanel />
          </PermissionGuard>
        )}
        {tab === 'recalls' && (
          <PermissionGuard permissions={RECALL_PERMS}>
            <CrmRecallPanel />
          </PermissionGuard>
        )}
        {tab === 'reminders' && (
          <PermissionGuard permissions={REMINDERS_PERMS}>
            <NotificationDeliveryLogPanel />
          </PermissionGuard>
        )}
        {tab === 'offers' && (
          <PermissionGuard permissions={OFFERS_PERMS}>
            <CrmOffersPanel />
          </PermissionGuard>
        )}
        {tab === 'feedback' && (
          <PermissionGuard permissions={FEEDBACK_PERMS}>
            <CrmFeedbackPanel />
          </PermissionGuard>
        )}
      </section>
    </PermissionGuard>
  );
}
