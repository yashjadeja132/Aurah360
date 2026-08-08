import { useTranslation } from 'react-i18next';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { LoyaltyCampaignsPanel } from '@/modules/loyalty/components/LoyaltyCampaignsPanel';

/** DEPRECATED — superseded by LoyaltyHubPage (`/loyalty?tab=campaigns`). Thin wrapper. */
export default function LoyaltyCampaignsPage() {
  const { t } = useTranslation();
  return (
    <PermissionGuard permissions={[PERMISSIONS.LOYALTY_CAMPAIGNS_MANAGE, PERMISSIONS.LOYALTY_ALL]} fallback="redirect">
      <section className="space-y-6">
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('loyalty.campaigns.title', 'Loyalty campaigns')}
        </h1>
        <LoyaltyCampaignsPanel />
      </section>
    </PermissionGuard>
  );
}
