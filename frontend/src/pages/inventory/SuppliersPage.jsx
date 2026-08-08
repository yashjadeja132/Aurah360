import { useTranslation } from 'react-i18next';
import { SuppliersPanel } from '@/modules/inventory/components/SuppliersPanel';

/**
 * Thin wrapper — the body lives in `SuppliersPanel` and is shared with the Inventory hub's
 * Suppliers tab.
 */
export default function SuppliersPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">
        {t('inventory.suppliers.title', 'Suppliers')}
      </h1>
      <SuppliersPanel />
    </section>
  );
}
