import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useLoyaltyDashboardSummary } from '@/modules/loyalty/hooks/useLoyalty';

function KpiCard({ label, value, subValue, isLoading }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{isLoading ? '—' : value ?? 0}</p>
      {!isLoading && subValue != null && (
        <p className="mt-0.5 text-xs text-muted-foreground">{subValue}</p>
      )}
    </div>
  );
}

/**
 * Program-health KPIs (was LoyaltyDashboardPage). Inside the loyalty hub the old
 * cross-page nav buttons become tab switches, so the panel takes an optional
 * `onNavigateTab` — when it is absent (standalone route) the shortcuts are hidden.
 */
export function LoyaltyOverviewPanel({ onNavigateTab }) {
  const { t } = useTranslation();
  const { data, isLoading } = useLoyaltyDashboardSummary();
  // GET /loyalty/reports/summary returns the summary fields flat in `data`.
  const summary = data || {};

  return (
    <div className="space-y-6">
      {onNavigateTab && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onNavigateTab('rules')}>
            {t('loyalty.dashboard.viewRules', 'Earning rules')}
          </Button>
          <Button variant="outline" onClick={() => onNavigateTab('campaigns')}>
            {t('loyalty.dashboard.viewCampaigns', 'Campaigns')}
          </Button>
          <Button variant="outline" onClick={() => onNavigateTab('approvals')}>
            {t('loyalty.dashboard.viewQueue', 'Adjustment queue')}
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label={t('loyalty.dashboard.totalLiability', 'Outstanding points liability')}
          value={summary.outstandingLiabilityPoints}
          subValue={
            summary.outstandingLiabilityInr == null ? null : `₹${summary.outstandingLiabilityInr}`
          }
          isLoading={isLoading}
        />
        <KpiCard
          label={t('loyalty.dashboard.issuedInRange', 'Points issued (selected range)')}
          value={summary.totalIssued}
          isLoading={isLoading}
        />
        <KpiCard
          label={t('loyalty.dashboard.redeemedInRange', 'Points redeemed (selected range)')}
          value={summary.totalRedeemed}
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
        <KpiCard
          label={t('loyalty.dashboard.pendingAdjustments', 'Adjustments awaiting approval')}
          value={summary.pendingAdjustments}
          isLoading={isLoading}
        />
      </div>

      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        {t(
          'loyalty.dashboard.note',
          'Loyalty tiers, when enabled, are a marketing/benefits feature only and never affect clinical queue priority.'
        )}
      </div>
    </div>
  );
}

export default LoyaltyOverviewPanel;
