import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { usePatientAppointmentHistory } from '@/modules/appointments/hooks/useAppointments';
import { usePatientDetail } from '@/modules/patients/hooks/usePatients';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_VARIANT,
} from '@/modules/appointments/constants';
import { appointmentDetailPath, patientDetailPath, APP_ROUTES } from '@/constants/routes';

export default function PatientAppointmentHistoryPage() {
  const { t } = useTranslation();
  const { patientId } = useParams();
  const { data: patient, isLoading: loadingPatient } = usePatientDetail(patientId);
  const { data: items = [], isLoading } = usePatientAppointmentHistory(patientId);

  if (loadingPatient || isLoading) return <Skeleton className="h-60 w-full" />;

  return (
    <section className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to={patient ? patientDetailPath(patientId) : APP_ROUTES.APPOINTMENTS}>
            ← {patient?.fullName || t('common.back', 'Back')}
          </Link>
        </Button>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('appointments.history.title', 'Appointment history')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {patient?.mrn} · {patient?.fullName}
        </p>
      </div>

      {!items.length ? (
        <EmptyState
          title={t('appointments.history.emptyTitle', 'No appointments')}
          description={t('appointments.history.emptyDescription', 'This patient has no visit history yet.')}
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {a.appointmentNumber} · {new Date(a.appointmentDate).toLocaleDateString()} {a.startTime}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.doctor?.name} · {a.service?.name} · {a.appointmentType}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={APPOINTMENT_STATUS_VARIANT[a.status]}>
                  {APPOINTMENT_STATUS_LABELS[a.status]}
                </Badge>
                <Button asChild variant="outline" size="sm">
                  <Link to={appointmentDetailPath(a.id)}>{t('appointments.history.open', 'Open')}</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
