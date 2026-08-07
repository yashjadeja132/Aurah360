import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pill } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePharmacyDashboard } from '@/modules/inventory/hooks/useInventory';
import { APP_ROUTES } from '@/constants/routes';

export default function PharmacyDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = usePharmacyDashboard();
  const summary = data?.summary || {};
  const queue = data?.recentQueue || [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('pharmacy.dashboard.title', 'Pharmacy')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('pharmacy.dashboard.subtitle', 'Dispense from finalized prescriptions — stock via inventory engine.')}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={APP_ROUTES.PHARMACY_QUEUE}>{t('pharmacy.dashboard.prescriptionQueue', 'Prescription queue')}</Link>
        </Button>
      </div>

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
        <h2 className="font-semibold">{t('pharmacy.dashboard.readyToDispense', 'Ready to dispense')}</h2>
        {queue.map((q) => (
          <div
            key={q.prescriptionId}
            className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <Pill className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">{q.prescriptionNumber}</p>
                <p className="text-xs text-muted-foreground">{q.itemCount} {t('pharmacy.dashboard.items', 'items')}</p>
              </div>
              <Badge>{q.dispenseStatus}</Badge>
            </div>
            <Button asChild size="sm">
              <Link to={`${APP_ROUTES.PHARMACY_QUEUE}?rx=${q.prescriptionId}`}>{t('pharmacy.dashboard.open', 'Open')}</Link>
            </Button>
          </div>
        ))}
        {!queue.length && !isLoading && (
          <p className="text-sm text-muted-foreground">{t('pharmacy.dashboard.noPending', 'No pending prescriptions.')}</p>
        )}
      </div>
    </section>
  );
}
