import { useTranslation } from 'react-i18next';
import { DuePaymentsPanel } from '@/modules/billing/components/DuePaymentsPanel';

/**
 * A.4 — standalone due-collection worklist. The body now lives in `DuePaymentsPanel` so the
 * billing hub renders it as a tab and the cashier landing can reuse the same table.
 */
export default function DuePaymentsPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('billing.duePayments.title', 'Due payments')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'billing.duePayments.subtitle',
            'Finalized invoices with an outstanding balance, oldest first. Collect while the patient is still at the desk.'
          )}
        </p>
      </div>
      <DuePaymentsPanel />
    </section>
  );
}
