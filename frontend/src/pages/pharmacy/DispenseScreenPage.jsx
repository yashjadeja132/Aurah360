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
import { toast } from 'sonner';
import { billingApi } from '@/modules/billing/api/billingApi';

const PAY_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'Online (UPI)' },
  { value: 'CARD', label: 'Card' },
];

/**
 * Simplified flow: the medical counter collects the medicine payment right after
 * dispensing — cash or online — as one MEDICINE-item invoice (create → finalize → pay).
 */
function CollectPaymentCard({ dispense }) {
  const dispensedLines = (dispense.items || []).filter((it) => (it.quantityDispensed || 0) > 0);
  const [prices, setPrices] = useState(() => dispensedLines.map(() => ''));
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(null);

  if (!dispensedLines.length) return null;

  const total = dispensedLines.reduce(
    (sum, it, i) => sum + (Number(prices[i]) || 0) * (it.quantityDispensed || 0),
    0
  );

  const collect = async () => {
    const patientId = dispense.patientId || dispense.patient?.id;
    const branchId = dispense.branchId;
    if (!patientId || !branchId) {
      toast.error('Missing patient/branch on this dispense');
      return;
    }
    if (total <= 0) {
      toast.error('Enter the medicine prices first');
      return;
    }
    if (method !== 'CASH' && !reference.trim()) {
      toast.error('Reference / transaction ID is required for online payment');
      return;
    }
    setBusy(true);
    try {
      const created = await billingApi.create({
        patientId,
        branchId,
        items: dispensedLines.map((it, i) => ({
          itemType: 'MEDICINE',
          referenceId: '',
          description: it.medicineName || 'Medicine',
          quantity: it.quantityDispensed || 1,
          unitPrice: Number(prices[i]) || 0,
          discount: 0,
        })),
      });
      const invoiceId = created?.data?.invoice?.id;
      if (!invoiceId) throw new Error('Invoice was not created');
      await billingApi.finalize(invoiceId);
      const invTotal = created?.data?.invoice?.total ?? total;
      await billingApi.recordPayment(invoiceId, {
        amount: invTotal,
        method,
        reference: method === 'CASH' ? null : reference.trim(),
      });
      setPaid({ amount: invTotal, method, invoiceNumber: created?.data?.invoice?.invoiceNumber });
      toast.success(`Payment of Rs.${invTotal} collected (${method})`);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Payment failed');
    } finally {
      setBusy(false);
    }
  };

  if (paid) {
    return (
      <div className="rounded-xl border border-success/50 bg-success-soft p-4 text-sm">
        <Badge variant="success">Paid ₹{paid.amount} · {paid.method}</Badge>
        {paid.invoiceNumber && (
          <span className="ml-2 text-muted-foreground">Invoice {paid.invoiceNumber}</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <h2 className="font-semibold">Collect payment</h2>
      <div className="space-y-2">
        {dispensedLines.map((it, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">
              {it.medicineName} × {it.quantityDispensed}
            </span>
            <Input
              type="number"
              min="0"
              placeholder="Price/unit"
              className="w-28"
              value={prices[i]}
              onChange={(e) => {
                const next = [...prices];
                next[i] = e.target.value;
                setPrices(next);
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="text-sm font-semibold">Total: ₹{total}</div>
        <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-36">
          {PAY_METHODS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
        {method !== 'CASH' && (
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Txn reference"
            className="w-40"
          />
        )}
        <Button size="sm" onClick={collect} disabled={busy}>
          {busy ? 'Collecting…' : 'Collect'}
        </Button>
      </div>
    </div>
  );
}

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
          {/* Points at the hub's queue tab rather than the standalone
              /pharmacy/queue route, so this back link keeps working once that
              route is folded into PharmacyHubPage. */}
          <Link to={`${APP_ROUTES.PHARMACY}?tab=queue`}>
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

      <CollectPaymentCard dispense={dispense} />
    </section>
  );
}
