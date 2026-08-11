import { useTranslation } from 'react-i18next';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useSales } from '@/modules/inventory/hooks/useInventory';

/**
 * Hub tab body for Direct/retail sales (PHARM-DIRECT). Lists `GET /pharmacy/sales`
 * the same way `PrescriptionQueuePanel` lists the dispense queue; the actual sale
 * form lives on its own route (`DirectSalePage`, /pharmacy/sales) since data entry
 * for a sale is a workflow, not something that fits inline in a tab.
 */
export function SalesPanel({ onNewSale }) {
  const { t } = useTranslation();
  const { data, isLoading } = useSales({ saleType: 'DIRECT', limit: 20 });
  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t('pharmacy.sales.subtitle', 'Counter / retail sale with no prescription behind it.')}
        </p>
        <Button size="sm" onClick={onNewSale}>
          {t('pharmacy.sales.newSale', 'New sale')}
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-20 w-full" />}
        {items.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{s.dispenseNumber}</p>
              <p className="text-xs text-muted-foreground">
                {s.items?.length || 0} {t('pharmacy.queue.items', 'items')} ·{' '}
                {s.dispensedAt ? new Date(s.dispensedAt).toLocaleString() : '—'}
              </p>
            </div>
            <Badge>{s.status}</Badge>
          </div>
        ))}
        {!items.length && !isLoading && (
          <EmptyState
            icon={ShoppingCart}
            title={t('pharmacy.sales.empty', 'No direct sales yet.')}
            description={t('pharmacy.sales.emptyHint', 'Recorded sales will show up here.')}
          />
        )}
      </div>
    </div>
  );
}

export default SalesPanel;
