import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pill } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { usePharmacyQueue, useStartDispense } from '@/modules/inventory/hooks/useInventory';
import { dispensePath } from '@/constants/routes';

/**
 * Body of the former PrescriptionQueuePage. `highlight` (the old `?rx=` param)
 * is now passed in by the hub, which owns the query string. "Dispense" still
 * creates/fetches the Dispense record and navigates to the standalone
 * /pharmacy/dispenses/:id route — that is a per-record workflow, not a tab.
 */
export function PrescriptionQueuePanel({ highlight = null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = usePharmacyQueue();
  const allItems = data?.items || [];
  const start = useStartDispense();
  const [q, setQ] = useState('');

  // The counter finds the patient by name/MRN/mobile — that is all they have.
  const term = q.trim().toLowerCase();
  const items = term
    ? allItems.filter((r) =>
        [r.patientName, r.patientMrn, r.patientMobile, r.prescriptionNumber, ...(r.medicines || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term)
      )
    : allItems;

  const open = async (prescriptionId) => {
    const res = await start.mutateAsync({ prescriptionId });
    const id = res?.data?.dispense?.id;
    if (id) navigate(dispensePath(id));
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('pharmacy.queue.subtitle', 'Finalized prescriptions awaiting dispense.')}
      </p>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('pharmacy.queue.search', 'Search patient name, mobile, MRN or medicine…')}
      />

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-20 w-full" />}
        {items.map((row) => (
          <div
            key={row.prescriptionId}
            className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
              highlight === row.prescriptionId ? 'border-primary' : ''
            }`}
          >
            <div className="min-w-0">
              <p className="font-medium">
                {row.patientName || t('pharmacy.queue.patient', 'Patient')}
                {row.patientMrn ? <span className="ml-1 text-xs text-muted-foreground">({row.patientMrn})</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.prescriptionNumber} · {row.itemCount} {t('pharmacy.queue.items', 'items')} ·{' '}
                {row.finalizedAt ? new Date(row.finalizedAt).toLocaleString() : '—'}
              </p>
              {row.medicines?.length ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.medicines.join(', ')}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Badge>{row.dispenseStatus}</Badge>
              <Button size="sm" disabled={start.isPending} onClick={() => open(row.prescriptionId)}>
                {t('pharmacy.queue.dispense', 'Dispense')}
              </Button>
            </div>
          </div>
        ))}
        {!items.length && !isLoading && (
          <EmptyState
            icon={Pill}
            title={t('pharmacy.queue.empty', 'Queue is empty.')}
            description={t(
              'pharmacy.hub.queue.emptyHint',
              'Nothing is awaiting dispense right now.'
            )}
          />
        )}
      </div>
    </div>
  );
}

export default PrescriptionQueuePanel;
