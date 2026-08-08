import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { QuickBookingPanel } from '@/modules/appointments/components/QuickBookingPanel';
import { APP_ROUTES, appointmentDetailPath } from '@/constants/routes';

export default function AppointmentBookPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const patientFromQuery = searchParams.get('patientId') || '';

  return (
    <section className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to={APP_ROUTES.APPOINTMENTS}>← {t('appointments.title', 'Appointments')}</Link>
        </Button>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('appointments.book.title', 'Book appointment')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'appointments.book.quickSubtitle',
            'Pick the patient, then just the time — returning patients reuse their last visit.'
          )}
        </p>
      </div>
      <QuickBookingPanel
        initialPatientId={patientFromQuery}
        onCreated={(appointment) => navigate(appointmentDetailPath(appointment.id))}
      />
    </section>
  );
}
