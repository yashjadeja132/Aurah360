import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useAppointmentList } from '@/modules/appointments/hooks/useAppointments';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_VARIANT,
} from '@/modules/appointments/constants';
import { APP_ROUTES, appointmentDetailPath } from '@/constants/routes';
import { cn } from '@/utils/cn';
import { addDaysKey, localDateKey, startOfWeek } from '@/utils/date';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AppointmentCalendarPage() {
  const { t } = useTranslation();
  const { data: doctorsData } = useDoctorList({ limit: 50, isActive: 'true' });
  const doctors = doctorsData?.items || [];
  const [doctorId, setDoctorId] = useState(''); // '' = all doctors
  const [view, setView] = useState('month');
  const today = localDateKey();
  const [day, setDay] = useState(today);
  const [weekStart, setWeekStart] = useState(localDateKey(startOfWeek(today)));
  const [month, setMonth] = useState(today.slice(0, 7)); // YYYY-MM

  // Cells + query range depend on the view.
  const { cells, range, label } = useMemo(() => {
    if (view === 'day') {
      return { cells: [day], range: { from: day, to: day }, label: day };
    }
    if (view === 'week') {
      const start = startOfWeek(weekStart);
      const days = Array.from({ length: 7 }, (_, i) => addDaysKey(i, start));
      return { cells: days, range: { from: days[0], to: days[6] }, label: `${days[0]} – ${days[6]}` };
    }
    // month
    const first = new Date(`${month}-01T00:00:00`);
    const gridStart = startOfWeek(localDateKey(first));
    const days = Array.from({ length: 42 }, (_, i) => addDaysKey(i, gridStart));
    return {
      cells: days,
      range: { from: days[0], to: days[41] },
      label: `${MONTHS[first.getMonth()]} ${first.getFullYear()}`,
    };
  }, [view, day, weekStart, month]);

  const { data: apptData, isLoading } = useAppointmentList({
    doctorId: doctorId || undefined,
    from: range.from,
    to: range.to,
    limit: 500,
  });
  const items = apptData?.items || [];

  const byDate = useMemo(() => {
    const map = {};
    items.forEach((a) => {
      const key = localDateKey(a.appointmentDate);
      (map[key] ||= []).push(a);
    });
    return map;
  }, [items]);

  const inMonth = (key) => key.slice(0, 7) === month;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to={APP_ROUTES.APPOINTMENTS}>← {t('appointments.title', 'Appointments')}</Link>
          </Button>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('appointments.calendar.title', 'Calendar')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border p-1">
          {['day', 'week', 'month'].map((v) => (
            <Button key={v} variant={view === v ? 'default' : 'ghost'} size="sm" onClick={() => setView(v)}>
              {t(`appointments.calendar.${v}`, v[0].toUpperCase() + v.slice(1))}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">{t('appointments.calendar.allDoctors', 'All doctors')}</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>{d.user?.fullName || d.doctorCode}</option>
          ))}
        </Select>
        {view === 'day' && <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />}
        {view === 'week' && <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />}
        {view === 'month' && <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : view === 'day' ? (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <h2 className="font-display text-lg font-semibold">
            {day} · {(byDate[day] || []).length} {t('appointments.calendar.appointments', 'appointments')}
          </h2>
          {(byDate[day] || [])
            .slice()
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map((a) => (
              <Link key={a.id} to={appointmentDetailPath(a.id)} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-accent">
                <div>
                  <p className="font-medium">{a.startTime}–{a.endTime} · {a.patient?.fullName}</p>
                  <p className="text-xs text-muted-foreground">{a.doctor?.user?.fullName || a.doctor?.name || '—'} · {a.appointmentNumber}</p>
                </div>
                <Badge variant={APPOINTMENT_STATUS_VARIANT[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
              </Link>
            ))}
          {!(byDate[day] || []).length && (
            <p className="text-sm text-muted-foreground">{t('appointments.calendar.noAppointmentsDay', 'No appointments this day.')}</p>
          )}
        </div>
      ) : view === 'week' ? (
        <div className="grid gap-2 sm:grid-cols-7">
          {cells.map((dateKey) => (
            <div key={dateKey} className="min-h-40 rounded-xl border bg-card p-2">
              <button type="button" className="mb-2 w-full text-left text-xs font-medium" onClick={() => { setDay(dateKey); setView('day'); }}>
                {DAY_NAMES[new Date(`${dateKey}T00:00:00`).getDay()]} {dateKey.slice(5)}
              </button>
              <div className="space-y-1">
                {(byDate[dateKey] || []).map((a) => (
                  <Link key={a.id} to={appointmentDetailPath(a.id)} className="block rounded-md border px-1.5 py-1 text-[10px] hover:bg-accent">
                    <span className="font-mono">{a.startTime}</span> {a.patient?.fullName?.split(' ')[0]}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-7 border-b text-center text-xs font-medium text-muted-foreground">
            {DAY_NAMES.map((d) => (<div key={d} className="py-1.5">{d}</div>))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((dateKey) => {
              const appts = byDate[dateKey] || [];
              const isToday = dateKey === today;
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => { setDay(dateKey); setView('day'); }}
                  className={cn(
                    'min-h-[92px] border-b border-r p-1 text-left align-top hover:bg-accent',
                    !inMonth(dateKey) && 'bg-muted/40 text-muted-foreground',
                    isToday && 'ring-1 ring-inset ring-primary'
                  )}
                >
                  <div className="mb-1 text-xs font-medium">{Number(dateKey.slice(8))}</div>
                  <div className="space-y-0.5">
                    {appts.slice(0, 3).map((a) => (
                      <div key={a.id} className="truncate rounded bg-primary/10 px-1 text-[10px] text-primary">
                        {a.startTime} {a.patient?.fullName?.split(' ')[0]}
                      </div>
                    ))}
                    {appts.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">+{appts.length - 3} more</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
