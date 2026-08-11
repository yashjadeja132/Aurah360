import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { SearchableCombobox } from '@/components/common/SearchableCombobox';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissions';
import { PERMISSIONS } from '@/constants/rbac';
import {
  useDispense,
  useDispenseItems,
  useInventoryItems,
} from '@/modules/inventory/hooks/useInventory';
import { APP_ROUTES } from '@/constants/routes';

// Deliberately checked on its own — PHARMACY_ALL must NOT confer this (see rbac.js).
const SUBSTITUTE_PERMS = [PERMISSIONS.PHARMACY_SUBSTITUTE];

export default function DispenseScreenPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useAuth();
  const canSubstitute = hasAnyPermission(user?.permissions, SUBSTITUTE_PERMS);
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
        isSubstituted: Boolean(it.substitution?.isSubstituted),
        substitutedMedicineId: it.substitution?.substitutedMedicineId || '',
        substitutionReason: it.substitution?.reason || '',
      }))
    );
  }, [dispense]);

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">{t('pharmacy.dispense.loading', 'Loading…')}</p>;
  if (!dispense) return <p className="p-6 text-sm text-destructive">{t('pharmacy.dispense.notFound', 'Dispense not found')}</p>;

  const completed = dispense.status === 'COMPLETED';

  // Block dispensing any line where substitution is toggled on but the mandatory reason is empty.
  const blockedBySubstitution = lines.some(
    (l) => l.quantity > 0 && l.inventoryItemId && l.isSubstituted && !l.substitutionReason?.trim()
  );

  const submit = (partial = false) => {
    if (blockedBySubstitution) return;
    const payloadItems = lines
      .filter((l) => l.quantity > 0 && l.inventoryItemId)
      .map((l) => ({
        prescriptionItemIndex: l.prescriptionItemIndex,
        inventoryItemId: l.inventoryItemId,
        batchNumber: l.batchNumber || undefined,
        quantity: partial ? Math.min(1, l.quantity) : l.quantity,
        ...(l.isSubstituted
          ? {
              substitution: {
                isSubstituted: true,
                substitutedMedicineId: l.substitutedMedicineId || undefined,
                reason: l.substitutionReason,
              },
            }
          : {}),
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
                  <SearchableCombobox
                    disabled={completed}
                    value={line.inventoryItemId}
                    onChange={(id) => {
                      const next = [...lines];
                      next[idx] = {
                        ...next[idx],
                        inventoryItemId: id,
                        batchNumber:
                          invItems.find((i) => i.id === id)?.batches?.[0]?.batchNumber || '',
                      };
                      setLines(next);
                    }}
                    options={invItems}
                    filterKeys={['name']}
                    renderLabel={(i) => i.name}
                    renderSublabel={(i) =>
                      `${t('pharmacy.dispense.stock', 'stock')} ${i.currentStock}${
                        i.stockStatus === 'LOW' ? ` · ${t('pharmacy.dispense.low', 'LOW')}` : ''
                      }`
                    }
                    placeholder={t('pharmacy.dispense.selectItem', 'Select item')}
                    emptyText={t('pharmacy.dispense.selectItem', 'Select item')}
                  />
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

              {canSubstitute && (
                <div className="space-y-2 rounded-lg border border-dashed p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      disabled={completed}
                      checked={line.isSubstituted}
                      onChange={(e) => {
                        const next = [...lines];
                        next[idx] = {
                          ...next[idx],
                          isSubstituted: e.target.checked,
                          ...(e.target.checked
                            ? {}
                            : { substitutedMedicineId: '', substitutionReason: '' }),
                        };
                        setLines(next);
                      }}
                    />
                    {t('pharmacy.dispense.substitute', 'Substitute')}
                  </label>

                  {line.isSubstituted && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>{t('pharmacy.dispense.substituteWith', 'Replacement medicine')}</Label>
                        <SearchableCombobox
                          disabled={completed}
                          value={line.substitutedMedicineId}
                          onChange={(id) => {
                            const next = [...lines];
                            next[idx] = { ...next[idx], substitutedMedicineId: id };
                            setLines(next);
                          }}
                          options={invItems}
                          filterKeys={['name']}
                          renderLabel={(i) => i.name}
                          renderSublabel={(i) => `${t('pharmacy.dispense.stock', 'stock')} ${i.currentStock}`}
                          placeholder={t('pharmacy.dispense.selectItem', 'Select item')}
                          emptyText={t('pharmacy.dispense.selectItem', 'Select item')}
                        />
                      </div>
                      <div>
                        <Label>{t('pharmacy.dispense.substitutionReason', 'Reason (required)')}</Label>
                        <Input
                          disabled={completed}
                          value={line.substitutionReason}
                          onChange={(e) => {
                            const next = [...lines];
                            next[idx] = { ...next[idx], substitutionReason: e.target.value };
                            setLines(next);
                          }}
                        />
                        {!line.substitutionReason?.trim() && (
                          <p className="mt-1 text-xs text-destructive">
                            {t(
                              'pharmacy.dispense.substitutionReasonRequired',
                              'A reason is required when substituting.'
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {Boolean(dispense.items?.[idx]?.substitution?.isSubstituted) && (
                <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {t('pharmacy.dispense.substitutedNotice', 'Substituted')}:{' '}
                  {dispense.items[idx].substitution.originalMedicineName || line.medicineName} →{' '}
                  {dispense.items[idx].substitution.substitutedMedicineName || '—'} —{' '}
                  {t('pharmacy.dispense.substitutionReasonLabel', 'reason')}:{' '}
                  {dispense.items[idx].substitution.reason || '—'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!completed && (
        <div className="space-y-2">
          {blockedBySubstitution && (
            <p className="text-sm text-destructive">
              {t(
                'pharmacy.dispense.substitutionBlocked',
                'Add a reason for every substituted line before dispensing.'
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={mutate.isPending || blockedBySubstitution} onClick={() => submit(false)}>
              {t('pharmacy.dispense.fullDispense', 'Full dispense')}
            </Button>
            <Button
              variant="outline"
              disabled={mutate.isPending || blockedBySubstitution}
              onClick={() => submit(true)}
            >
              {t('pharmacy.dispense.partialUnit', 'Partial (1 unit)')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
