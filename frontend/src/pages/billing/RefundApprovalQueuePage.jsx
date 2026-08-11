import { useTranslation } from 'react-i18next';
import { RefundApprovalPanel } from '@/modules/billing/components/RefundApprovalPanel';

/** A.8 — standalone approver queue for refunds above the org's approval threshold. */
export default function RefundApprovalQueuePage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('billing.refundApprovals.title', 'Refund approvals')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'billing.refundApprovals.subtitle',
            'Refunds above the approval threshold. No money moves until you decide.'
          )}
        </p>
      </div>
      <RefundApprovalPanel />
    </section>
  );
}
