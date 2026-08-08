import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { APP_ROUTES } from '@/constants/routes';
import { LoyaltyOverviewPanel } from '@/modules/loyalty/components/LoyaltyOverviewPanel';

/**
 * DEPRECATED — superseded by LoyaltyHubPage (`/loyalty` with ?tab=overview).
 * Kept as a thin wrapper around the shared panel so the legacy route keeps
 * working until the hub wiring lands; delete once the route is removed.
 */
export default function LoyaltyDashboardPage() {
  const { t } = useTranslation();
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
      <LoyaltyOverviewPanel />
    </section>
  );
}
