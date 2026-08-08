import { useTranslation } from 'react-i18next';
import { Pill } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { usePharmacyDashboard } from '@/modules/inventory/hooks/useInventory';

/**
 * Body of the former PharmacyDashboardPage. The header "Prescription queue"
 * button is gone — that is now a sibling tab. Each ready-to-dispense row's
 * "Open" used to navigate to `${PHARMACY_QUEUE}?rx=<id>`; inside the hub it
 * switches to the queue tab with the same `rx` highlight param, preserving the
 * original behaviour (highlight the row, do not create a dispense record).
 */
export function PharmacyOverviewPanel({ onOpenPrescription }) {
  const { t } = useTranslation();
  const { data, isLoading } = usePharmacyDashboard();
  const summary = data?.summary || {};
  const queue = data?.recentQueue || [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t(
          'pharmacy.dashboard.subtitle',
          'Dispense from finalized prescriptions — stock via inventory engine.'
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [t('pharmacy.dashboard.queue', 'Queue'), summary.queue],
          [t('pharmacy.dashboard.dispensedToday', 'Dispensed today'), summary.dispensedToday],
          [t('pharmacy.dashboard.partial', 'Partial'), summary.partial],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{isLoading ? '—' : value ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">
          {t('pharmacy.dashboard.readyToDispense', 'Ready to dispense')}
        </h2>
        {isLoading && <Skeleton className="h-20 w-full" />}
        {queue.map((q) => (
          <div
            key={q.prescriptionId}
            className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <Pill className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">{q.prescriptionNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {q.itemCount} {t('pharmacy.dashboard.items', 'items')}
                </p>
              </div>
              <Badge>{q.dispenseStatus}</Badge>
            </div>
            <Button size="sm" onClick={() => onOpenPrescription?.(q.prescriptionId)}>
              {t('pharmacy.dashboard.open', 'Open')}
            </Button>
          </div>
        ))}
        {!queue.length && !isLoading && (
          <EmptyState
            icon={Pill}
            title={t('pharmacy.dashboard.noPending', 'No pending prescriptions.')}
            description={t(
              'pharmacy.hub.overview.noPendingHint',
              'Finalized prescriptions appear here as soon as a doctor signs them.'
            )}
          />
        )}
      </div>
    </div>
  );
}

export default PharmacyOverviewPanel;
