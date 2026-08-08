import { Link } from 'react-router-dom';
import { Pill } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { usePatientPrescriptions } from '@/modules/prescriptions/hooks/usePrescriptions';
import { PRESCRIPTION_STATUS_LABELS } from '@/modules/prescriptions/constants';
import { prescriptionEditPath, prescriptionPrintPath } from '@/constants/routes';

const STATUS_VARIANT = {
  FINALIZED: 'success',
  DRAFT: 'warning',
  CANCELLED: 'destructive',
};

/** Prescription history inside the 360° patient profile — no navigation away from the profile. */
export function PatientPrescriptionsPanel({ patientId }) {
  const { t } = useTranslation();
  const { data: items = [], isLoading } = usePatientPrescriptions(patientId);

  if (isLoading) return <Skeleton className="h-60 w-full" />;

  if (!items.length) {
    return (
      <EmptyState
        icon={Pill}
        title={t('patients.detail.prescriptions.emptyTitle', 'No prescriptions')}
        description={t(
          'patients.detail.prescriptions.emptyDescription',
          'This patient has no prescriptions yet.'
        )}
      />
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((rx) => {
        const medicines = (rx.items || [])
          .map((it) => [it.medicineName, it.strength].filter(Boolean).join(' '))
          .filter(Boolean);
        const summary = medicines.slice(0, 3).join(', ');
        const extra = medicines.length - 3;
        const issuedAt = rx.finalizedAt || rx.createdAt;
        return (
          <li
            key={rx.id}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <Pill className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium">
                  {rx.prescriptionNumber} ·{' '}
                  {issuedAt ? new Date(issuedAt).toLocaleDateString() : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {rx.doctor?.name ||
                    t('patients.detail.prescriptions.noDoctor', 'Doctor not recorded')}
                  {' · '}
                  {summary ||
                    t('patients.detail.prescriptions.noMedicines', 'No medicines recorded')}
                  {extra > 0 &&
                    ` ${t('patients.detail.prescriptions.more', '+{{count}} more', {
                      count: extra,
                    })}`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATUS_VARIANT[rx.status] || 'outline'}>
                {PRESCRIPTION_STATUS_LABELS[rx.status] || rx.status}
              </Badge>
              <Button asChild variant="outline" size="sm">
                <Link to={prescriptionEditPath(rx.id)}>
                  {t('patients.detail.prescriptions.open', 'Open')}
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to={prescriptionPrintPath(rx.id)}>
                  {t('patients.detail.prescriptions.print', 'Print')}
                </Link>
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default PatientPrescriptionsPanel;
