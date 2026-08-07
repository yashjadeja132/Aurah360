import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useDoctorCalendar } from '@/modules/appointments/hooks/useAppointments';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_VARIANT,
} from '@/modules/appointments/constants';
import { APP_ROUTES, appointmentDetailPath } from '@/constants/routes';
import { cn } from '@/utils/cn';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfWeek(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function AppointmentCalendarPage() {
  const { t } = useTranslation();
  const { data: doctorsData } = useDoctorList({ limit: 50, isActive: 'true' });
  const doctors = doctorsData?.items || [];
  const [doctorId, setDoctorId] = useState('');
  const [weekStart, setWeekStart] = useState(startOfWeek().toISOString().slice(0, 10));
  const [view, setView] = useState('week');
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));

  const activeDoctor = doctorId || doctors[0]?.id || '';

  const range = useMemo(() => {
    if (view === 'day') {
      return { from: day, to: day };
    }
    const start = startOfWeek(weekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }, [view, weekStart, day]);

  const { data: items = [], isLoading } = useDoctorCalendar(
    { doctorId: activeDoctor, from: range.from, to: range.to },
    Boolean(activeDoctor)
  );

  const byDate = useMemo(() => {
    const map = {};
    items.forEach((a) => {
      const key = new Date(a.appointmentDate).toISOString().slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [items]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d.toISOString().slice(0, 10);
    });
  }, [weekStart]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to={APP_ROUTES.APPOINTMENTS}>← {t('appointments.title', 'Appointments')}</Link>
          </Button>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('appointments.calendar.title', 'Calendar')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('appointments.calendar.subtitle', 'Doctor day & weekly views')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={view === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setView('week')}>
            {t('appointments.calendar.weekly', 'Weekly')}
          </Button>
          <Button variant={view === 'day' ? 'default' : 'outline'} size="sm" onClick={() => setView('day')}>
            {t('appointments.calendar.daily', 'Daily')}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Select value={activeDoctor} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">{t('appointments.calendar.selectDoctor', 'Select doctor')}</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>{d.user?.fullName || d.doctorCode}</option>
          ))}
        </Select>
        {view === 'week' ? (
          <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
        ) : (
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : view === 'week' ? (
        <div className="grid gap-2 sm:grid-cols-7">
          {weekDays.map((dateKey) => (
            <div key={dateKey} className="min-h-40 rounded-xl border bg-card p-2">
              <button
                type="button"
                className="mb-2 w-full text-left text-xs font-medium"
                onClick={() => { setDay(dateKey); setView('day'); }}
              >
                {DAY_NAMES[new Date(dateKey).getDay()]} {dateKey.slice(5)}
              </button>
              <div className="space-y-1">
                {(byDate[dateKey] || []).map((a) => (
                  <Link
                    key={a.id}
                    to={appointmentDetailPath(a.id)}
                    className={cn('block rounded-md border px-1.5 py-1 text-[10px] hover:bg-accent')}
                  >
                    <span className="font-mono">{a.startTime}</span>{' '}
                    {a.patient?.fullName?.split(' ')[0]}
                    <Badge className="ml-1" variant={APPOINTMENT_STATUS_VARIANT[a.status]}>
                      {a.status.slice(0, 3)}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <h2 className="font-display text-lg font-semibold">
            {day} · {t('appointments.calendar.appointmentsCount', '{{count}} appointments', { count: (byDate[day] || []).length })}
          </h2>
          {(byDate[day] || [])
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((a) => (
              <Link
                key={a.id}
                to={appointmentDetailPath(a.id)}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-accent"
              >
                <div>
                  <p className="font-medium">{a.startTime}–{a.endTime} · {a.patient?.fullName}</p>
                  <p className="text-xs text-muted-foreground">{a.service?.name} · {a.appointmentNumber}</p>
                </div>
                <Badge variant={APPOINTMENT_STATUS_VARIANT[a.status]}>
                  {APPOINTMENT_STATUS_LABELS[a.status]}
                </Badge>
              </Link>
            ))}
          {!(byDate[day] || []).length && (
            <p className="text-sm text-muted-foreground">
              {t('appointments.calendar.noAppointmentsDay', 'No appointments this day.')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
