import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useInventoryDashboard, useInventoryItems } from '@/modules/inventory/hooks/useInventory';
import { APP_ROUTES } from '@/constants/routes';

export default function InventoryDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useInventoryDashboard();
  const { data: lowData } = useInventoryItems({ lowStock: 'true', limit: 8 });
  const summary = data?.summary || {};
  const low = lowData?.items || [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('inventory.dashboard.title', 'Inventory')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('inventory.dashboard.subtitle', 'Medicines & consumables — single stock engine for pharmacy and treatments.')}
          </p>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          [t('inventory.dashboard.totalItems', 'Total items'), summary.totalItems],
          [t('inventory.dashboard.lowStock', 'Low stock'), summary.lowStock],
          [t('inventory.dashboard.outOfStock', 'Out of stock'), summary.outOfStock],
          [t('inventory.dashboard.nearExpiryBatches', 'Near expiry batches'), summary.nearExpiryBatches],
          [t('inventory.dashboard.expiredBatches', 'Expired batches'), summary.expiredBatches],
          [t('inventory.dashboard.stockValue', 'Stock value'), summary.totalValue],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{isLoading ? '—' : value ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">{t('inventory.dashboard.lowStockSection', 'Low stock')}</h2>
        {low.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border p-3"
          >
            <div className="flex items-center gap-3">
              <Package className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.itemCode} · {item.location || '—'}
                </p>
              </div>
              <Badge variant="destructive">{t('inventory.dashboard.low', 'LOW')}</Badge>
            </div>
            <p className="text-sm font-semibold">{item.currentStock}</p>
          </div>
        ))}
        {!low.length && (
          <p className="text-sm text-muted-foreground">{t('inventory.dashboard.noLowStock', 'No low-stock items.')}</p>
        )}
      </div>
    </section>
  );
}
