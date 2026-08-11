import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuickBookingPanel } from '@/modules/appointments/components/QuickBookingPanel';
import { CheckInDialog } from '@/modules/reception/components/CheckInDialog';
import { APP_ROUTES, appointmentDetailPath } from '@/constants/routes';
// 'Today' must come from the LOCAL calendar day — see '@/utils/date'.
import { todayKey } from '@/utils/date';

export default function AppointmentBookPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const patientFromQuery = searchParams.get('patientId') || '';

  const [booked, setBooked] = useState(null);
  const [checkInOpen, setCheckInOpen] = useState(false);

  // Booked-today is the only case a same-screen "Check-in now" makes sense — anything else has
  // no queue token to join yet.
  const isToday = booked?.appointmentDate?.slice(0, 10) === todayKey();

  if (booked) {
    return (
      <section className="space-y-6">
        <Card className="border-success/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-success" />
              {t('appointments.book.successTitle', 'Appointment booked')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('appointments.book.number', 'Appointment no.')}
                </dt>
                <dd className="font-medium">{booked.appointmentNumber}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('appointments.book.patient', 'Patient')}
                </dt>
                <dd className="font-medium">{booked.patient?.fullName || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('appointments.book.dateTime', 'Date / time')}
                </dt>
                <dd className="font-medium">
                  {booked.appointmentDate?.slice(0, 10)} · {booked.startTime}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('appointments.book.doctor', 'Doctor')}
                </dt>
                <dd className="font-medium">{booked.doctor?.name || '—'}</dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to={appointmentDetailPath(booked.id)}>
                  {t('appointments.book.viewAppointment', 'View appointment')}
                </Link>
              </Button>
              {isToday && (
                <Button onClick={() => setCheckInOpen(true)}>
                  {t('appointments.book.checkInNow', 'Check-in now')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <CheckInDialog
          open={checkInOpen}
          onOpenChange={(open) => {
            setCheckInOpen(open);
            if (!open) navigate(appointmentDetailPath(booked.id));
          }}
          appointment={booked}
        />
      </section>
    );
  }

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
      <QuickBookingPanel initialPatientId={patientFromQuery} onCreated={setBooked} />
    </section>
  );
}
