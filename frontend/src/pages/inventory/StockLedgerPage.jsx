import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StockLedgerPanel } from '@/modules/inventory/components/StockLedgerPanel';

/**
 * Thin wrapper — the body lives in `StockLedgerPanel` and is shared with the Inventory hub's
 * Stock ledger tab. `?itemId=` is passed through as the panel's initial item filter so a deep link
 * from another module lands pre-filtered, matching the hub's behaviour.
 */
export default function StockLedgerPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">
        {t('inventory.ledger.title', 'Stock Ledger')}
      </h1>
      <StockLedgerPanel initialItemId={params.get('itemId') || ''} />
    </section>
  );
}
