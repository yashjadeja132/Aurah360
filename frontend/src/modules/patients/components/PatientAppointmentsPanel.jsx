import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { usePatientAppointmentHistory } from '@/modules/appointments/hooks/useAppointments';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_VARIANT,
} from '@/modules/appointments/constants';
import { appointmentDetailPath } from '@/constants/routes';

/** Appointment history inside the 360° patient profile — no navigation away from the profile. */
export function PatientAppointmentsPanel({ patientId }) {
  const { t } = useTranslation();
  const { data: items = [], isLoading } = usePatientAppointmentHistory(patientId);

  if (isLoading) return <Skeleton className="h-60 w-full" />;

  if (!items.length) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={t('appointments.history.emptyTitle', 'No appointments')}
        description={t('appointments.history.emptyDescription', 'This patient has no visit history yet.')}
      />
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((a) => (
        <li key={a.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">
              {a.appointmentNumber} · {new Date(a.appointmentDate).toLocaleDateString()} {a.startTime}
            </p>
            <p className="text-xs text-muted-foreground">
              {[a.doctor?.name, a.service?.name, a.appointmentType].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={APPOINTMENT_STATUS_VARIANT[a.status]}>
              {APPOINTMENT_STATUS_LABELS[a.status] || a.status}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link to={appointmentDetailPath(a.id)}>{t('appointments.history.open', 'Open')}</Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default PatientAppointmentsPanel;
