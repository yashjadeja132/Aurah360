import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { APP_ROUTES } from '@/constants/routes';
import { useLoyaltyDashboardSummary } from '@/modules/loyalty/hooks/useLoyalty';

function KpiCard({ label, value, isLoading }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{isLoading ? '—' : value ?? 0}</p>
    </div>
  );
}

export default function LoyaltyDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useLoyaltyDashboardSummary();
  const summary = data?.summary || {};

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('loyalty.dashboard.title', 'Loyalty & Rewards')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('loyalty.dashboard.subtitle', 'Program health, points liability, and campaign activity at a glance')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.LOYALTY_RULES}>{t('loyalty.dashboard.viewRules', 'Earning rules')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.LOYALTY_CAMPAIGNS}>{t('loyalty.dashboard.viewCampaigns', 'Campaigns')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.LOYALTY_ADJUSTMENTS}>{t('loyalty.dashboard.viewQueue', 'Adjustment queue')}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label={t('loyalty.dashboard.totalLiability', 'Total points liability')}
          value={summary.totalPointsLiability}
          isLoading={isLoading}
        />
        <KpiCard
          label={t('loyalty.dashboard.issuedThisMonth', 'Points issued this month')}
          value={summary.pointsIssuedThisMonth}
          isLoading={isLoading}
        />
        <KpiCard
          label={t('loyalty.dashboard.redeemedThisMonth', 'Points redeemed this month')}
          value={summary.pointsRedeemedThisMonth}
          isLoading={isLoading}
        />
        <KpiCard
          label={t('loyalty.dashboard.expiringSoon', 'Expiring in 30 days')}
          value={summary.pointsExpiringIn30Days}
          isLoading={isLoading}
        />
        <KpiCard
          label={t('loyalty.dashboard.activeCampaigns', 'Active campaigns')}
          value={summary.activeCampaignsCount}
          isLoading={isLoading}
        />
      </div>

      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        {t(
          'loyalty.dashboard.note',
          'Loyalty tiers, when enabled, are a marketing/benefits feature only and never affect clinical queue priority.'
        )}
      </div>
    </section>
  );
}
