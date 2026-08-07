import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  usePharmacyQueue,
  useStartDispense,
} from '@/modules/inventory/hooks/useInventory';
import { dispensePath } from '@/constants/routes';

export default function PrescriptionQueuePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const highlight = params.get('rx');
  const { data, isLoading } = usePharmacyQueue();
  const items = data?.items || [];
  const start = useStartDispense();

  const open = async (prescriptionId) => {
    const res = await start.mutateAsync({ prescriptionId });
    const id = res?.data?.dispense?.id;
    if (id) navigate(dispensePath(id));
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('pharmacy.queue.title', 'Prescription Queue')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('pharmacy.queue.subtitle', 'Finalized prescriptions awaiting dispense.')}
        </p>
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">{t('pharmacy.queue.loading', 'Loading…')}</p>}
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
          <p className="text-sm text-muted-foreground">{t('pharmacy.queue.empty', 'Queue is empty.')}</p>
        )}
      </div>
    </section>
  );
}
