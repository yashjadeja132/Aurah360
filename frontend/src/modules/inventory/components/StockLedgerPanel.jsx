import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useStockLedger } from '@/modules/inventory/hooks/useInventory';

const TX_TYPES = [
  'PURCHASE',
  'ADJUSTMENT',
  'DISPENSE',
  'RETURN',
  'TRANSFER',
  'CONSUMPTION',
  'OPENING_STOCK',
];

/**
 * Body of the former StockLedgerPage. `inventoryItemId` can now be supplied by
 * the hub (e.g. drilled in from another tab) while remaining editable here.
 */
export function StockLedgerPanel({ initialItemId = '' }) {
  const { t } = useTranslation();
  const [type, setType] = useState('');
  const [itemId, setItemId] = useState(initialItemId);
  const [deepLinked, setDeepLinked] = useState(Boolean(initialItemId));
  const { data, isLoading } = useStockLedger({
    type: type || undefined,
    inventoryItemId: itemId || undefined,
    limit: 100,
  });
  const rows = data?.items || [];
  // Deep-linked from the hub (e.g. "View ledger" on an item) — the ledger rows for that
  // item already carry a human-readable name/SKU, so use those instead of ever putting the
  // raw ObjectId into a visible text field.
  const deepLinkedItemLabel = rows[0]?.itemName
    ? `${rows[0].itemName}${rows[0].itemSku ? ` (${rows[0].itemSku})` : ''}`
    : t('common.loading', 'Loading…');

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t(
          'inventory.ledger.subtitle',
          'Immutable stock transactions — all movements through InventoryService.'
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {deepLinked && itemId ? (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="font-medium">{deepLinkedItemLabel}</span>
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => setDeepLinked(false)}
            >
              {t('inventory.ledger.changeItem', 'Change')}
            </button>
          </div>
        ) : (
          <Input
            placeholder={t('inventory.ledger.itemIdPlaceholder', 'Inventory item ID (optional)')}
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
          />
        )}
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('inventory.ledger.allTypes', 'All types')}</option>
          {TX_TYPES.map((txType) => (
            <option key={txType} value={txType}>
              {txType}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {rows.map((tx) => (
          <div
            key={tx.id}
            className="flex flex-col gap-1 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {tx.transactionNumber} <Badge variant="outline">{tx.type}</Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                {/* Never render the raw ObjectId — it means nothing to a storekeeper. */}
                {t('inventory.ledger.item', 'Item')}{' '}
                {tx.itemName || t('inventory.ledger.unknownItem', 'Unknown item')}
                {tx.itemSku ? ` (${tx.itemSku})` : ''} ·{' '}
                {t('inventory.ledger.batch', 'Batch')} {tx.batchNumber || '—'} ·{' '}
                {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : ''}
              </p>
            </div>
            <div className="text-right">
              <p className={tx.quantity < 0 ? 'text-destructive' : 'text-emerald-700'}>
                {tx.quantity > 0 ? '+' : ''}
                {tx.quantity}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('inventory.ledger.balance', 'Bal')} {tx.balanceAfter}
              </p>
            </div>
          </div>
        ))}
        {!rows.length && !isLoading && (
          <EmptyState
            icon={ScrollText}
            title={t('inventory.ledger.noTransactions', 'No transactions.')}
            description={t(
              'inventory.hub.ledger.emptyHint',
              'Stock movements appear here once goods are received, dispensed, adjusted or transferred.'
            )}
          />
        )}
      </div>
    </div>
  );
}

export default StockLedgerPanel;
