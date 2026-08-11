import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { SearchableCombobox } from '@/components/common/SearchableCombobox';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import {
  useInventoryItems,
  useCreateSale,
  useSales,
  useUpdateInventoryItem,
} from '@/modules/inventory/hooks/useInventory';
import { APP_ROUTES } from '@/constants/routes';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissions';
import { PERMISSIONS } from '@/constants/rbac';

const ITEM_EDIT_PERMS = [PERMISSIONS.INVENTORY_EDIT, PERMISSIONS.INVENTORY_ALL];

function emptyLine() {
  return { inventoryItemId: '', batchNumber: '', quantity: 1 };
}

/**
 * Direct / retail sale (PHARM-DIRECT) — counter sale with no prescription behind it.
 * Reuses the same Auto-FEFO batch-select pattern as DispenseScreenPage, and hard-blocks
 * (client side) any line whose selected product is flagged `requiresPrescription: true` —
 * the backend already rejects these lines; this is a pre-emptive UI warning so the cashier
 * never gets as far as a server error.
 */
export default function DirectSalePage() {
  const { t } = useTranslation();
  const { data: invData, isLoading: itemsLoading } = useInventoryItems({
    itemType: 'MEDICINE',
    limit: 200,
  });
  const invItems = invData?.items || [];
  const createSale = useCreateSale();
  const { data: salesData, isLoading: salesLoading } = useSales({ saleType: 'DIRECT', limit: 10 });
  const sales = salesData?.items || [];
  const { user } = useAuth();
  const canEditItems = hasAnyPermission(user?.permissions, ITEM_EDIT_PERMS);
  const updateItem = useUpdateInventoryItem();

  const [lines, setLines] = useState([emptyLine()]);

  const rxBlockedLines = useMemo(
    () =>
      lines
        .map((l, idx) => ({ idx, item: invItems.find((i) => i.id === l.inventoryItemId) }))
        .filter((x) => x.item?.requiresPrescription),
    [lines, invItems]
  );
  const hasRxBlock = rxBlockedLines.length > 0;

  const total = lines.reduce((sum, l) => {
    const item = invItems.find((i) => i.id === l.inventoryItemId);
    const price = item?.sellingPrice ?? item?.mrp ?? 0;
    return sum + price * (Number(l.quantity) || 0);
  }, 0);

  const updateLine = (idx, patch) => {
    const next = [...lines];
    next[idx] = { ...next[idx], ...patch };
    setLines(next);
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const canSubmit =
    !hasRxBlock &&
    lines.some((l) => l.inventoryItemId && Number(l.quantity) > 0) &&
    !createSale.isPending;

  const submit = () => {
    if (!canSubmit) return;
    const items = lines
      .filter((l) => l.inventoryItemId && Number(l.quantity) > 0)
      .map((l) => ({
        inventoryItemId: l.inventoryItemId,
        batchNumber: l.batchNumber || undefined,
        quantity: Number(l.quantity),
      }));
    if (!items.length) return;
    createSale.mutate(
      { items },
      {
        onSuccess: () => setLines([emptyLine()]),
      }
    );
  };

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`${APP_ROUTES.PHARMACY}?tab=sales`}>
            <ArrowLeft className="h-4 w-4" />
            {t('pharmacy.sales.back', 'Pharmacy')}
          </Link>
        </Button>
        <h1 className="mt-1 font-display text-2xl font-semibold text-primary">
          {t('pharmacy.sales.title', 'Direct sale')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('pharmacy.sales.subtitle', 'Counter / retail sale with no prescription behind it.')}
        </p>
      </div>

      <div className="space-y-4">
        {lines.map((line, idx) => {
          const selected = invItems.find((i) => i.id === line.inventoryItemId);
          const batches = selected?.batches || [];
          const rxBlocked = Boolean(selected?.requiresPrescription);

          return (
            <div key={idx} className="space-y-3 rounded-xl border p-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <Label>{t('pharmacy.sales.product', 'Product')}</Label>
                  <SearchableCombobox
                    value={line.inventoryItemId}
                    onChange={(id) => {
                      const item = invItems.find((i) => i.id === id);
                      updateLine(idx, {
                        inventoryItemId: id,
                        batchNumber: item?.batches?.[0]?.batchNumber || '',
                      });
                    }}
                    options={invItems}
                    filterKeys={['name']}
                    renderLabel={(i) => i.name}
                    renderSublabel={(i) =>
                      `${t('pharmacy.dispense.stock', 'stock')} ${i.currentStock}${
                        i.requiresPrescription ? ` · ${t('pharmacy.sales.rxOnly', 'Rx only')}` : ''
                      }`
                    }
                    placeholder={t('pharmacy.sales.selectProduct', 'Select product')}
                    emptyText={t('pharmacy.sales.selectProduct', 'Select product')}
                  />
                </div>
                <div>
                  <Label>{t('pharmacy.dispense.batch', 'Batch')}</Label>
                  <Select
                    value={line.batchNumber}
                    onChange={(e) => updateLine(idx, { batchNumber: e.target.value })}
                  >
                    <option value="">{t('pharmacy.dispense.autoFefo', 'Auto FEFO')}</option>
                    {batches.map((b) => (
                      <option key={b.batchNumber} value={b.batchNumber}>
                        {b.batchNumber} · {t('pharmacy.dispense.qty', 'qty')} {b.quantity} · {t('pharmacy.dispense.exp', 'exp')}{' '}
                        {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : '—'}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>{t('pharmacy.sales.quantity', 'Quantity')}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                  />
                </div>
              </div>

              {rxBlocked && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {t(
                    'pharmacy.sales.rxBlocked',
                    'This product requires a prescription and cannot be sold as a direct/retail sale. Remove it or route the patient through the prescription queue.'
                  )}
                </p>
              )}

              {canEditItems && selected && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(selected.requiresPrescription)}
                    disabled={updateItem.isPending}
                    onChange={(e) =>
                      updateItem.mutate({
                        id: selected.id,
                        payload: { requiresPrescription: e.target.checked },
                      })
                    }
                  />
                  {t('pharmacy.sales.toggleRx', 'Requires prescription (product master)')}
                </label>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {selected
                    ? `${t('pharmacy.sales.lineTotal', 'Line total')}: ${(
                        (selected.sellingPrice ?? selected.mrp ?? 0) * (Number(line.quantity) || 0)
                      ).toFixed(2)}`
                    : ''}
                </p>
                {lines.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeLine(idx)}>
                    {t('pharmacy.sales.removeLine', 'Remove')}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {itemsLoading && <Skeleton className="h-10 w-full" />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" onClick={addLine}>
          {t('pharmacy.sales.addLine', 'Add line')}
        </Button>
        <p className="text-lg font-semibold">
          {t('pharmacy.sales.total', 'Total')}: {total.toFixed(2)}
        </p>
      </div>

      <Button disabled={!canSubmit} onClick={submit}>
        {createSale.isPending
          ? t('pharmacy.sales.submitting', 'Recording…')
          : t('pharmacy.sales.submit', 'Record sale')}
      </Button>

      <div className="space-y-2">
        <h2 className="font-semibold">{t('pharmacy.sales.recent', 'Recent sales')}</h2>
        {salesLoading && <Skeleton className="h-16 w-full" />}
        {sales.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border p-3">
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
        {!sales.length && !salesLoading && (
          <EmptyState
            title={t('pharmacy.sales.empty', 'No direct sales yet.')}
            description={t('pharmacy.sales.emptyHint', 'Recorded sales will show up here.')}
          />
        )}
      </div>
    </section>
  );
}
