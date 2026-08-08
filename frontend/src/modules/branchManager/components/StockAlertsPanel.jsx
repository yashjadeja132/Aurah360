import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Boxes, PackageX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { APP_ROUTES } from '@/constants/routes';

const MAX_ROWS = 6;

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

/**
 * B1 — the stock half of the command screen: what is about to run out and what is about to expire,
 * branch-scoped, so the manager never has to open the Inventory module to find out.
 *
 * `lowStock` rows come from `GET /inventory/items?lowStock=true` (available stock at or below the
 * item's reorder level); `expiring` rows come from `GET /inventory/reports/expiry`, one row per
 * BATCH, already flagged EXPIRED or NEAR_EXPIRY by the service.
 */
export function StockAlertsPanel({ stock }) {
  const { t } = useTranslation();

  const low = (stock.lowStock || []).slice(0, MAX_ROWS);
  const expiring = (stock.expiring || []).slice(0, MAX_ROWS);
  const nothing = !stock.isLoading && !stock.lowStockCount && !stock.expiringCount;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="h-4 w-4" />
            {t('branchDay.stock.title', 'Stock alerts')}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('branchDay.stock.summary', '{{low}} at or below reorder level · {{expiring}} batch(es) expiring · {{expired}} already expired', {
              low: stock.lowStockCount,
              expiring: stock.expiringCount,
              expired: stock.expiredCount,
            })}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={APP_ROUTES.INVENTORY}>
            {t('branchDay.stock.open', 'Inventory')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {stock.isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {nothing && (
          <EmptyState
            icon={PackageX}
            title={t('branchDay.stock.emptyTitle', 'Stock is healthy')}
            description={t(
              'branchDay.stock.emptyDescription',
              'Nothing at this branch is below its reorder level or near expiry.'
            )}
          />
        )}

        {!stock.isLoading && low.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('branchDay.stock.lowHeading', 'Running out')}
            </p>
            <ul className="divide-y">
              {low.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.itemCode}</p>
                  </div>
                  <Badge variant="warning" className="shrink-0">
                    {t('branchDay.stock.lowValue', '{{stock}} left · reorder at {{level}}', {
                      stock: item.currentStock ?? 0,
                      level: item.reorderLevel ?? 0,
                    })}
                  </Badge>
                </li>
              ))}
            </ul>
            {stock.lowStockCount > low.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('branchDay.stock.andMoreLow', '+{{count}} more below reorder level', {
                  count: stock.lowStockCount - low.length,
                })}
              </p>
            )}
          </div>
        )}

        {!stock.isLoading && expiring.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('branchDay.stock.expiryHeading', 'Expiring')}
            </p>
            <ul className="divide-y">
              {expiring.map((row) => (
                <li
                  key={`${row.inventoryItemId}-${row.batchNumber}`}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('branchDay.stock.batchLine', 'Batch {{batch}} · qty {{qty}} · {{date}}', {
                        batch: row.batchNumber || '—',
                        qty: row.quantity ?? 0,
                        date: formatDate(row.expiryDate),
                      })}
                    </p>
                  </div>
                  <Badge
                    variant={row.status === 'EXPIRED' ? 'destructive' : 'warning'}
                    className="shrink-0"
                  >
                    {row.status === 'EXPIRED'
                      ? t('branchDay.stock.expired', 'Expired')
                      : t('branchDay.stock.nearExpiry', 'Near expiry')}
                  </Badge>
                </li>
              ))}
            </ul>
            {stock.expiringCount > expiring.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('branchDay.stock.andMoreExpiring', '+{{count}} more expiring batch(es)', {
                  count: stock.expiringCount - expiring.length,
                })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default StockAlertsPanel;
