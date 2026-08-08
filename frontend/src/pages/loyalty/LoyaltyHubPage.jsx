import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissions';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';
import { LoyaltyOverviewPanel } from '@/modules/loyalty/components/LoyaltyOverviewPanel';
import { LoyaltyRulesPanel } from '@/modules/loyalty/components/LoyaltyRulesPanel';
import { LoyaltyTiersPanel } from '@/modules/loyalty/components/LoyaltyTiersPanel';
import { LoyaltyCampaignsPanel } from '@/modules/loyalty/components/LoyaltyCampaignsPanel';
import { LoyaltyApprovalsPanel } from '@/modules/loyalty/components/LoyaltyApprovalsPanel';
import { LoyaltySettingsPanel } from '@/modules/loyalty/components/LoyaltySettingsPanel';

/**
 * Permission sets carried over verbatim from the six pages this hub replaces
 * (LoyaltyDashboard/Rules/Tiers/Campaigns/AdjustmentQueue/Settings) so a tab is
 * visible to exactly the roles that could previously reach its route.
 */
const OVERVIEW_PERMS = [
  PERMISSIONS.LOYALTY_SETTINGS_VIEW,
  PERMISSIONS.LOYALTY_RULES_VIEW,
  PERMISSIONS.LOYALTY_REPORTS_VIEW,
  PERMISSIONS.LOYALTY_ALL,
];
const RULES_PERMS = [
  PERMISSIONS.LOYALTY_RULES_VIEW,
  PERMISSIONS.LOYALTY_RULES_MANAGE,
  PERMISSIONS.LOYALTY_ALL,
];
const SETTINGS_PERMS = [
  PERMISSIONS.LOYALTY_SETTINGS_VIEW,
  PERMISSIONS.LOYALTY_SETTINGS_MANAGE,
  PERMISSIONS.LOYALTY_ALL,
];
const CAMPAIGNS_PERMS = [PERMISSIONS.LOYALTY_CAMPAIGNS_MANAGE, PERMISSIONS.LOYALTY_ALL];
const APPROVALS_PERMS = [PERMISSIONS.LOYALTY_ADJUST_APPROVE, PERMISSIONS.LOYALTY_ALL];

/** Union of every tab gate — what it takes to see the hub at all. */
export const LOYALTY_HUB_PERMISSIONS = [
  ...new Set([
    ...OVERVIEW_PERMS,
    ...RULES_PERMS,
    ...SETTINGS_PERMS,
    ...CAMPAIGNS_PERMS,
    ...APPROVALS_PERMS,
  ]),
];

/**
 * Single Loyalty & Rewards screen. Replaces six sidebar destinations with one
 * route + client-side tabs (?tab=… keeps a tab deep-linkable/bookmarkable).
 * Tab entries are permission-conditional AND each panel is wrapped in its own
 * PermissionGuard, so a hand-typed ?tab= cannot reveal a panel the user's role
 * could not previously open.
 */
export default function LoyaltyHubPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const perms = user?.permissions;

  const canViewOverview = hasAnyPermission(perms, OVERVIEW_PERMS);
  const canViewRules = hasAnyPermission(perms, RULES_PERMS);
  const canViewSettings = hasAnyPermission(perms, SETTINGS_PERMS);
  const canManageCampaigns = hasAnyPermission(perms, CAMPAIGNS_PERMS);
  const canApproveAdjustments = hasAnyPermission(perms, APPROVALS_PERMS);

  const TABS = useMemo(
    () => [
      ...(canViewOverview ? [{ id: 'overview', label: t('loyalty.hub.tabs.overview', 'Overview') }] : []),
      ...(canViewRules ? [{ id: 'rules', label: t('loyalty.hub.tabs.rules', 'Rules') }] : []),
      ...(canViewSettings ? [{ id: 'tiers', label: t('loyalty.hub.tabs.tiers', 'Tiers') }] : []),
      ...(canManageCampaigns ? [{ id: 'campaigns', label: t('loyalty.hub.tabs.campaigns', 'Campaigns') }] : []),
      ...(canApproveAdjustments ? [{ id: 'approvals', label: t('loyalty.hub.tabs.approvals', 'Approvals') }] : []),
      ...(canViewSettings ? [{ id: 'settings', label: t('loyalty.hub.tabs.settings', 'Settings') }] : []),
    ],
    [t, canViewOverview, canViewRules, canViewSettings, canManageCampaigns, canApproveAdjustments]
  );

  const requested = searchParams.get('tab');
  const tab = TABS.some((tb) => tb.id === requested) ? requested : TABS[0]?.id;

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  return (
    <PermissionGuard permissions={LOYALTY_HUB_PERMISSIONS} fallback="redirect">
      <section className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('loyalty.dashboard.title', 'Loyalty & Rewards')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'loyalty.hub.subtitle',
              'Program health, earning rules, tiers, campaigns, approvals and settings in one place'
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
          <PermissionGuard permissions={OVERVIEW_PERMS}>
            <LoyaltyOverviewPanel onNavigateTab={setTab} />
          </PermissionGuard>
        )}
        {tab === 'rules' && (
          <PermissionGuard permissions={RULES_PERMS}>
            <LoyaltyRulesPanel />
          </PermissionGuard>
        )}
        {tab === 'tiers' && (
          <PermissionGuard permissions={SETTINGS_PERMS}>
            <LoyaltyTiersPanel />
          </PermissionGuard>
        )}
        {tab === 'campaigns' && (
          <PermissionGuard permissions={CAMPAIGNS_PERMS}>
            <LoyaltyCampaignsPanel />
          </PermissionGuard>
        )}
        {tab === 'approvals' && (
          <PermissionGuard permissions={APPROVALS_PERMS}>
            <LoyaltyApprovalsPanel />
          </PermissionGuard>
        )}
        {tab === 'settings' && (
          <PermissionGuard permissions={SETTINGS_PERMS}>
            <LoyaltySettingsPanel />
          </PermissionGuard>
        )}
      </section>
    </PermissionGuard>
  );
}
