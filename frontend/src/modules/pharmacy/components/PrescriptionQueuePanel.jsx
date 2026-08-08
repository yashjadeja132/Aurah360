import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pill } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  const items = data?.items || [];
  const start = useStartDispense();

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

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-20 w-full" />}
        {items.map((q) => (
          <div
            key={q.prescriptionId}
            className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
              highlight === q.prescriptionId ? 'border-primary' : ''
            }`}
          >
            <div>
              <p className="font-medium">{q.prescriptionNumber}</p>
              <p className="text-xs text-muted-foreground">
                {q.itemCount} {t('pharmacy.queue.items', 'items')} ·{' '}
                {q.finalizedAt ? new Date(q.finalizedAt).toLocaleString() : '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{q.dispenseStatus}</Badge>
              <Button size="sm" disabled={start.isPending} onClick={() => open(q.prescriptionId)}>
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
