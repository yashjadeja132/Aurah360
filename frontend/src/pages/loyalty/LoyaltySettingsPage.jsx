import { useTranslation } from 'react-i18next';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { LoyaltySettingsPanel } from '@/modules/loyalty/components/LoyaltySettingsPanel';

/** DEPRECATED — superseded by LoyaltyHubPage (`/loyalty?tab=settings`). Thin wrapper. */
export default function LoyaltySettingsPage() {
  const { t } = useTranslation();
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.LOYALTY_SETTINGS_VIEW, PERMISSIONS.LOYALTY_SETTINGS_MANAGE, PERMISSIONS.LOYALTY_ALL]}
      fallback="redirect"
    >
      <section className="space-y-6">
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('loyalty.settings.title', 'Loyalty program settings')}
        </h1>
        <LoyaltySettingsPanel />
      </section>
    </PermissionGuard>
  );
}
