import { useTranslation } from 'react-i18next';
import { InvoiceListPanel } from '@/modules/billing/components/InvoiceListPanel';

/**
 * Standalone invoice list. The body now lives in `InvoiceListPanel` so the billing hub
 * (`BillingHubPage`) can render exactly the same UI as a client-side tab; this route stays for
 * deep links and existing bookmarks.
 */
export default function InvoiceListPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('billing.list.title', 'Billing')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('billing.list.subtitle', 'Invoices & payments — no treatment execution, inventory, or pharmacy.')}
          </p>
        </div>
      </div>
      <InvoiceListPanel />
    </section>
  );
}
