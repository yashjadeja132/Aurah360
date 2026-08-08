import { useTranslation } from 'react-i18next';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { LoyaltyApprovalsPanel } from '@/modules/loyalty/components/LoyaltyApprovalsPanel';

/** DEPRECATED — superseded by LoyaltyHubPage (`/loyalty?tab=approvals`). Thin wrapper. */
export default function LoyaltyAdjustmentQueuePage() {
  const { t } = useTranslation();
  return (
    <PermissionGuard permissions={[PERMISSIONS.LOYALTY_ADJUST_APPROVE, PERMISSIONS.LOYALTY_ALL]} fallback="redirect">
      <section className="space-y-6">
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('loyalty.adjustments.title', 'Manual adjustment approval queue')}
        </h1>
        <LoyaltyApprovalsPanel />
      </section>
    </PermissionGuard>
  );
}
