import { useTranslation } from 'react-i18next';
import { PurchaseOrdersPanel } from '@/modules/inventory/components/PurchaseOrdersPanel';

/**
 * Thin wrapper — the body lives in `PurchaseOrdersPanel` and is shared with the Inventory hub's
 * Purchase orders tab.
 */
export default function PurchaseOrdersPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">
        {t('inventory.po.title', 'Purchase Orders')}
      </h1>
      <PurchaseOrdersPanel />
    </section>
  );
}
