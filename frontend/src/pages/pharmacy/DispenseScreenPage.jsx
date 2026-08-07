import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import {
  useDispense,
  useDispenseItems,
  useInventoryItems,
} from '@/modules/inventory/hooks/useInventory';
import { APP_ROUTES } from '@/constants/routes';

export default function DispenseScreenPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: dispense, isLoading } = useDispense(id);
  const mutate = useDispenseItems(id);
  const { data: invData } = useInventoryItems({ itemType: 'MEDICINE', limit: 100 });
  const invItems = invData?.items || [];

  const [lines, setLines] = useState([]);

  useEffect(() => {
    if (!dispense?.items) return;
    setLines(
      dispense.items.map((it) => ({
        prescriptionItemIndex: it.prescriptionItemIndex,
        medicineName: it.medicineName,
        quantityRequested: it.quantityRequested,
        quantityDispensed: it.quantityDispensed,
        status: it.status,
        inventoryItemId: it.inventoryItemId || '',
        batchNumber: it.batchNumber || '',
        quantity: Math.max(0, (it.quantityRequested || 0) - (it.quantityDispensed || 0)),
      }))
    );
  }, [dispense]);

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">{t('pharmacy.dispense.loading', 'Loading…')}</p>;
  if (!dispense) return <p className="p-6 text-sm text-destructive">{t('pharmacy.dispense.notFound', 'Dispense not found')}</p>;

  const completed = dispense.status === 'COMPLETED';

  const submit = (partial = false) => {
    const payloadItems = lines
      .filter((l) => l.quantity > 0 && l.inventoryItemId)
      .map((l) => ({
        prescriptionItemIndex: l.prescriptionItemIndex,
        inventoryItemId: l.inventoryItemId,
        batchNumber: l.batchNumber || undefined,
        quantity: partial ? Math.min(1, l.quantity) : l.quantity,
      }));
    if (!payloadItems.length) return;
    mutate.mutate({ items: payloadItems });
  };

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={APP_ROUTES.PHARMACY_QUEUE}>
            <ArrowLeft className="h-4 w-4" />
            {t('pharmacy.dispense.queue', 'Queue')}
          </Link>
        </Button>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold text-primary">
            {dispense.dispenseNumber}
          </h1>
          <Badge>{dispense.status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {dispense.prescription?.prescriptionNumber} · {dispense.patient?.fullName}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('pharmacy.dispense.barcodeHint', 'Barcode scan placeholder · select batch · expiry checked server-side')}
        </p>
      </div>

      <div className="space-y-4">
        {lines.map((line, idx) => {
          const selected = invItems.find((i) => i.id === line.inventoryItemId);
          const batches = selected?.batches || [];
          const near =
            batches.find((b) => b.batchNumber === line.batchNumber)?.expiryDate &&
            new Date(batches.find((b) => b.batchNumber === line.batchNumber).expiryDate) -
              Date.now() <
              90 * 864e5;

          return (
            <div key={idx} className="space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{line.medicineName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('pharmacy.dispense.requested', 'Requested')} {line.quantityRequested} · {t('pharmacy.dispense.done', 'Done')} {line.quantityDispensed}
                  </p>
                </div>
                <Badge variant="outline">{line.status}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>{t('pharmacy.dispense.medicineStock', 'Medicine / stock')}</Label>
                  <Select
                    disabled={completed}
                    value={line.inventoryItemId}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = {
                        ...next[idx],
                        inventoryItemId: e.target.value,
                        batchNumber:
                          invItems.find((i) => i.id === e.target.value)?.batches?.[0]
                            ?.batchNumber || '',
                      };
                      setLines(next);
                    }}
                  >
                    <option value="">{t('pharmacy.dispense.selectItem', 'Select item')}</option>
                    {invItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} · {t('pharmacy.dispense.stock', 'stock')} {i.currentStock}
                        {i.stockStatus === 'LOW' ? ` · ${t('pharmacy.dispense.low', 'LOW')}` : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>{t('pharmacy.dispense.batch', 'Batch')}</Label>
                  <Select
                    disabled={completed}
                    value={line.batchNumber}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx], batchNumber: e.target.value };
                      setLines(next);
                    }}
                  >
                    <option value="">{t('pharmacy.dispense.autoFefo', 'Auto FEFO')}</option>
                    {batches.map((b) => (
                      <option key={b.batchNumber} value={b.batchNumber}>
                        {b.batchNumber} · {t('pharmacy.dispense.qty', 'qty')} {b.quantity} · {t('pharmacy.dispense.exp', 'exp')}{' '}
                        {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : '—'}
                      </option>
                    ))}
                  </Select>
                  {near && (
                    <p className="mt-1 text-xs text-amber-700">{t('pharmacy.dispense.nearExpiryWarning', 'Near expiry warning')}</p>
                  )}
                </div>
                <div>
                  <Label>{t('pharmacy.dispense.qtyThisPass', 'Qty this pass')}</Label>
                  <Input
                    type="number"
                    min={0}
                    disabled={completed}
                    value={line.quantity}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                      setLines(next);
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!completed && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={mutate.isPending} onClick={() => submit(false)}>
            {t('pharmacy.dispense.fullDispense', 'Full dispense')}
          </Button>
          <Button variant="outline" disabled={mutate.isPending} onClick={() => submit(true)}>
            {t('pharmacy.dispense.partialUnit', 'Partial (1 unit)')}
          </Button>
        </div>
      )}
    </section>
  );
}
