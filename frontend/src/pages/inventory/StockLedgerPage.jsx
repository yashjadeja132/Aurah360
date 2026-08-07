import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useStockLedger } from '@/modules/inventory/hooks/useInventory';

export default function StockLedgerPage() {
  const { t } = useTranslation();
  const [type, setType] = useState('');
  const [itemId, setItemId] = useState('');
  const { data, isLoading } = useStockLedger({
    type: type || undefined,
    inventoryItemId: itemId || undefined,
    limit: 100,
  });
  const rows = data?.items || [];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('inventory.ledger.title', 'Stock Ledger')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('inventory.ledger.subtitle', 'Immutable stock transactions — all movements through InventoryService.')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          placeholder={t('inventory.ledger.itemIdPlaceholder', 'Inventory item ID (optional)')}
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
        />
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t('inventory.ledger.allTypes', 'All types')}</option>
          {[
            'PURCHASE',
            'ADJUSTMENT',
            'DISPENSE',
            'RETURN',
            'TRANSFER',
            'CONSUMPTION',
            'OPENING_STOCK',
          ].map((txType) => (
            <option key={txType} value={txType}>
              {txType}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">{t('inventory.ledger.loading', 'Loading…')}</p>}
        {rows.map((tx) => (
          <div
            key={tx.id}
            className="flex flex-col gap-1 rounded-xl border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {tx.transactionNumber}{' '}
                <Badge variant="outline">{tx.type}</Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                {t('inventory.ledger.item', 'Item')} {tx.inventoryItemId} · {t('inventory.ledger.batch', 'Batch')} {tx.batchNumber || '—'} ·{' '}
                {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : ''}
              </p>
            </div>
            <div className="text-right">
              <p className={tx.quantity < 0 ? 'text-destructive' : 'text-emerald-700'}>
                {tx.quantity > 0 ? '+' : ''}
                {tx.quantity}
              </p>
              <p className="text-xs text-muted-foreground">{t('inventory.ledger.balance', 'Bal')} {tx.balanceAfter}</p>
            </div>
          </div>
        ))}
        {!rows.length && !isLoading && (
          <p className="text-sm text-muted-foreground">{t('inventory.ledger.noTransactions', 'No transactions.')}</p>
        )}
      </div>
    </section>
  );
}
