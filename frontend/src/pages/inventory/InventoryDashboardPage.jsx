import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { InventoryOverviewPanel } from '@/modules/inventory/components/InventoryOverviewPanel';
import { APP_ROUTES } from '@/constants/routes';

/**
 * Thin wrapper — the body lives in `InventoryOverviewPanel` and is shared with the Inventory hub's
 * Overview tab. The three sibling links stay here because standalone there are no sibling tabs to
 * reach them through; `onNavigateTab`/`availableTabs` are deliberately not passed so the KPI tiles
 * stay plain (non-clickable), exactly as this page rendered before.
 */
export default function InventoryDashboardPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('inventory.dashboard.title', 'Inventory')}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.INVENTORY_LEDGER}>{t('inventory.dashboard.stockLedger', 'Stock ledger')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.PURCHASE_ORDERS}>{t('inventory.dashboard.purchaseOrders', 'Purchase orders')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.SUPPLIERS}>{t('inventory.dashboard.suppliers', 'Suppliers')}</Link>
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('inventory.dashboard.subtitle', 'Medicines & consumables — single stock engine for pharmacy and treatments.')}
      </p>
      <InventoryOverviewPanel />
    </section>
  );
}
