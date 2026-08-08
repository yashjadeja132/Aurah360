import { useTranslation } from 'react-i18next';
import { DiscountApprovalPanel } from '@/modules/billing/components/DiscountApprovalPanel';

/**
 * A.5 — standalone approver queue. Route-level `billing.discount_approve` gating is unchanged; the
 * body now lives in `DiscountApprovalPanel` so the billing hub renders it as a tab.
 */
export default function DiscountApprovalQueuePage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('billing.discountApprovals.title', 'Discount approvals')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'billing.discountApprovals.subtitle',
            'Draft invoices whose discount is above the approval threshold. These invoices cannot be finalized until you decide.'
          )}
        </p>
      </div>
      <DiscountApprovalPanel />
    </section>
  );
}
