import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { APP_ROUTES } from '@/constants/routes';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useOwnerBranchComparison } from '@/modules/reports/hooks/useOwnerLanding';
import { OwnerBranchScorecard } from '@/modules/reports/components/OwnerBranchScorecard';
import { OwnerApprovalsPanel } from '@/modules/reports/components/OwnerApprovalsPanel';
import { useProviderStatus } from '@/modules/notifications/hooks/useNotifications';

/** §0 — [Quick create] menu: shortcuts to the highest-traffic creation actions. Pure navigation,
 *  no new creation flow — every link below already exists as its own page. */
function QuickCreateMenu() {
  const { t } = useTranslation();
  const items = [
    { to: APP_ROUTES.BRANCH_CREATE, label: t('owner.landing.quickCreate.branch', 'New branch') },
    { to: APP_ROUTES.STAFF_CREATE, label: t('owner.landing.quickCreate.staff', 'New staff user') },
    { to: APP_ROUTES.SETTINGS, label: t('owner.landing.quickCreate.master', 'New master item') },
    { to: APP_ROUTES.CRM_OFFERS, label: t('owner.landing.quickCreate.offer', 'New offer / campaign') },
  ];
  return (
    <details className="relative inline-block">
      <summary className="inline-flex list-none cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted [&::-webkit-details-marker]:hidden">
        <Plus className="h-4 w-4" />
        {t('owner.landing.quickCreate.title', 'Quick create')}
        <ChevronDown className="h-3.5 w-3.5" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border bg-popover p-1 shadow-lg">
        {items.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

const PROVIDER_LABELS = { whatsapp: 'WhatsApp', sms: 'SMS', voice: 'Voice', push: 'Push', email: 'Email', ai: 'AI' };

/** §0 — provider health strip. Basic read: "configured or not" from env/config presence via
 *  GET /notifications/provider-status, not a live ping — good enough for this pass. */
function ProviderHealthStrip() {
  const { t } = useTranslation();
  const { data: status, isLoading } = useProviderStatus();

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3">
      <span className="text-sm font-medium text-muted-foreground">
        {t('owner.landing.providerHealth.title', 'Provider status')}
      </span>
      {isLoading && <span className="text-xs text-muted-foreground">…</span>}
      {!isLoading &&
        Object.entries(status || {}).map(([key, info]) => (
          <Badge key={key} variant={info?.configured ? 'success' : 'secondary'}>
            {PROVIDER_LABELS[key] || key}: {info?.configured
              ? t('owner.landing.providerHealth.configured', 'Configured')
              : t('owner.landing.providerHealth.notConfigured', 'Not configured')}
          </Badge>
        ))}
    </div>
  );
}

/**
 * Owner landing — the "90-second morning glance" the flow doc asks for.
 *
 * One screen, no navigation required:
 *   1. revenue / new patients / completed treatments for every branch and the
 *      all-branches total, today framed against yesterday;
 *   2. everything awaiting the owner's sign-off (discount approvals, loyalty
 *      manual adjustments, cash-close approvals).
 *
 * All data comes from endpoints that already exist — see
 * `modules/reports/hooks/useOwnerLanding.js` for why `GET /reports/analytics`
 * is the source rather than the executive or owner dashboard endpoints.
 */
export default function OwnerLandingPage() {
  const { t } = useTranslation();
  // `limit` is capped at 100 server-side.
  const { data: branchesData, isLoading: branchesLoading } = useBranchList({ limit: 100 });
  const branches = branchesData?.items || [];

  const comparison = useOwnerBranchComparison(branches);

  return (
    <section className="space-y-6">
      <PageHeader
        title={t('owner.landing.title', 'Today at a glance')}
        description={t(
          'owner.landing.subtitle',
          'Every branch, today against yesterday, plus everything waiting on your approval.'
        )}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to={APP_ROUTES.REPORTS}>{t('reports.hubTitle', 'Reports & Analytics')}</Link>
            </Button>
            <QuickCreateMenu />
          </div>
        }
      />

      <ProviderHealthStrip />

      <OwnerBranchScorecard
        rows={comparison.rows}
        totals={comparison.totals}
        isLoading={branchesLoading || comparison.isLoading}
        isError={comparison.isError}
        error={comparison.error}
      />

      <OwnerApprovalsPanel />
    </section>
  );
}
