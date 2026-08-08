import { useTranslation } from 'react-i18next';
import { CashClosePanel } from '@/modules/billing/components/CashClosePanel';

/**
 * BIL-003 — standalone daily cash close. The body now lives in `CashClosePanel` so the billing hub
 * renders it as a tab.
 */
export default function CashClosePage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('billing.cashClose.title', 'Cash close')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('billing.cashClose.subtitle', 'Daily branch cash reconciliation — opening, collection, refunds, expected vs counted.')}
        </p>
      </div>
      <CashClosePanel />
    </section>
  );
}
