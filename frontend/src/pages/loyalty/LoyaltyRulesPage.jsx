import { useTranslation } from 'react-i18next';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { LoyaltyRulesPanel } from '@/modules/loyalty/components/LoyaltyRulesPanel';

/** DEPRECATED — superseded by LoyaltyHubPage (`/loyalty?tab=rules`). Thin wrapper. */
export default function LoyaltyRulesPage() {
  const { t } = useTranslation();
  return (
    <PermissionGuard
      permissions={[PERMISSIONS.LOYALTY_RULES_VIEW, PERMISSIONS.LOYALTY_RULES_MANAGE, PERMISSIONS.LOYALTY_ALL]}
      fallback="redirect"
    >
      <section className="space-y-6">
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('loyalty.rules.title', 'Earning rules')}
        </h1>
        <LoyaltyRulesPanel />
      </section>
    </PermissionGuard>
  );
}
