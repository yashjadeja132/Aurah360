import { useTranslation } from 'react-i18next';
import { Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { useInventoryDashboard, useInventoryItems } from '@/modules/inventory/hooks/useInventory';

/**
 * Body of the former InventoryDashboardPage. The three "go to Stock ledger /
 * Purchase orders / Suppliers" buttons that used to sit in the page header are
 * gone — those are now sibling tabs in the hub. The KPI tiles stay identical,
 * and the expired/near-expiry counts become in-hub jumps to the Expiry tab so
 * the alert leads somewhere instead of being a dead number.
 */
export function InventoryOverviewPanel({ onNavigateTab, availableTabs = [] }) {
  const { t } = useTranslation();
  const { data, isLoading } = useInventoryDashboard();
  const { data: lowData, isLoading: lowLoading } = useInventoryItems({ lowStock: 'true', limit: 8 });
  const summary = data?.summary || {};
  const low = lowData?.items || [];

  const canJumpToExpiry = availableTabs.includes('expiry') && typeof onNavigateTab === 'function';

  const tiles = [
    { key: 'totalItems', label: t('inventory.dashboard.totalItems', 'Total items'), value: summary.totalItems },
    { key: 'lowStock', label: t('inventory.dashboard.lowStock', 'Low stock'), value: summary.lowStock },
    { key: 'outOfStock', label: t('inventory.dashboard.outOfStock', 'Out of stock'), value: summary.outOfStock },
    {
      key: 'nearExpiryBatches',
      label: t('inventory.dashboard.nearExpiryBatches', 'Near expiry batches'),
      value: summary.nearExpiryBatches,
      expiry: true,
    },
    {
      key: 'expiredBatches',
      label: t('inventory.dashboard.expiredBatches', 'Expired batches'),
      value: summary.expiredBatches,
      expiry: true,
    },
    { key: 'stockValue', label: t('inventory.dashboard.stockValue', 'Stock value'), value: summary.totalValue },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => {
          const clickable = tile.expiry && canJumpToExpiry;
          const Tag = clickable ? 'button' : 'div';
          return (
            <Tag
              key={tile.key}
              {...(clickable
                ? { type: 'button', onClick: () => onNavigateTab('expiry'), className: 'rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary' }
                : { className: 'rounded-xl border bg-card p-4' })}
            >
              <p className="text-xs text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-2xl font-semibold">{isLoading ? '—' : tile.value ?? 0}</p>
              {clickable && (
                <p className="mt-1 text-xs text-primary">
                  {t('inventory.hub.overview.viewExpiry', 'View expiry report')}
                </p>
              )}
            </Tag>
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{t('inventory.dashboard.lowStockSection', 'Low stock')}</h2>
          {low.length > 0 && availableTabs.includes('transfers') && typeof onNavigateTab === 'function' && (
            <Button variant="outline" size="sm" onClick={() => onNavigateTab('transfers')}>
              {t('inventory.hub.overview.requestTransfer', 'Request a transfer')}
            </Button>
          )}
        </div>
        {lowLoading && <Skeleton className="h-20 w-full" />}
        {low.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border p-3">
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
        {!low.length && !lowLoading && (
          <EmptyState
            icon={Package}
            title={t('inventory.dashboard.noLowStock', 'No low-stock items.')}
            description={t(
              'inventory.hub.overview.noLowStockHint',
              'Every tracked item is above its minimum stock level.'
            )}
          />
        )}
      </div>
    </div>
  );
}

export default InventoryOverviewPanel;
