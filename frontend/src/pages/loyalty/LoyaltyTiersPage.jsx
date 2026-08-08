import { useTranslation } from 'react-i18next';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { LoyaltyTiersPanel } from '@/modules/loyalty/components/LoyaltyTiersPanel';

/** DEPRECATED — superseded by LoyaltyHubPage (`/loyalty?tab=tiers`). Thin wrapper. */
export default function LoyaltyTiersPage() {
  const { t } = useTranslation();
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.LOYALTY_SETTINGS_VIEW, PERMISSIONS.LOYALTY_SETTINGS_MANAGE, PERMISSIONS.LOYALTY_ALL]}
      fallback="redirect"
    >
      <section className="space-y-6">
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('loyalty.tiers.title', 'Loyalty tiers')}
        </h1>
        <LoyaltyTiersPanel />
      </section>
    </PermissionGuard>
  );
}
