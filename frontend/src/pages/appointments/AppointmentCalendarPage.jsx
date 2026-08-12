import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useAppointmentList } from '@/modules/appointments/hooks/useAppointments';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_VARIANT } from '@/modules/appointments/constants';
import { ColorDot, colorFor } from '@/components/common/ColorDot';
import { useClinicId } from '@/stores/clinicStore';
import { APP_ROUTES, appointmentDetailPath } from '@/constants/routes';
import { cn } from '@/utils/cn';
import { addDaysKey, localDateKey, startOfWeek } from '@/utils/date';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Status → dot color (legend + chips).
const STATUS_DOT = {
  COMPLETED: 'bg-green-500',
  CANCELLED: 'bg-red-500',
  NO_SHOW: 'bg-red-500',
  CHECKED_IN: 'bg-amber-500',
  IN_CONSULTATION: 'bg-amber-500',
  CONFIRMED: 'bg-blue-500',
  SCHEDULED: 'bg-slate-400',
  RESCHEDULED: 'bg-slate-400',
};
const LEGEND = [
  { label: 'Completed', c: 'bg-green-500' },
  { label: 'In progress', c: 'bg-amber-500' },
  { label: 'Confirmed', c: 'bg-blue-500' },
  { label: 'Scheduled', c: 'bg-slate-400' },
  { label: 'Cancelled', c: 'bg-red-500' },
];

function addMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function AppointmentCalendarPage() {
  const { t } = useTranslation();
  const clinicId = useClinicId();
  const { data: doctorsData } = useDoctorList({ limit: 50, isActive: 'true' });
  const doctors = doctorsData?.items || [];
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branchName = useMemo(() => {
    const map = {};
    (branchesData?.items || branchesData?.branches || []).forEach((b) => { map[b.id || b._id] = b.displayName || b.name; });
    return map;
  }, [branchesData]);

  const [doctorId, setDoctorId] = useState('');
  const [view, setView] = useState('month');
  const today = localDateKey();
  const [day, setDay] = useState(today);
  const [weekStart, setWeekStart] = useState(localDateKey(startOfWeek(today)));
  const [month, setMonth] = useState(today.slice(0, 7));

  const go = (delta) => {
    if (view === 'day') setDay(addDaysKey(delta, day));
    else if (view === 'week') setWeekStart(addDaysKey(delta * 7, weekStart));
    else setMonth(addMonth(month, delta));
  };
  const goToday = () => { setDay(today); setWeekStart(localDateKey(startOfWeek(today))); setMonth(today.slice(0, 7)); };

  const { cells, range, label } = useMemo(() => {
    if (view === 'day') return { cells: [day], range: { from: day, to: day }, label: day };
    if (view === 'week') {
      const start = startOfWeek(weekStart);
      const days = Array.from({ length: 7 }, (_, i) => addDaysKey(i, start));
      return { cells: days, range: { from: days[0], to: days[6] }, label: `${days[0]} – ${days[6]}` };
    }
    const first = new Date(`${month}-01T00:00:00`);
    const gridStart = startOfWeek(localDateKey(first));
    const days = Array.from({ length: 42 }, (_, i) => addDaysKey(i, gridStart));
    return { cells: days, range: { from: days[0], to: days[41] }, label: `${MONTHS[first.getMonth()]} ${first.getFullYear()}` };
  }, [view, day, weekStart, month]);

  const { data: apptData, isLoading } = useAppointmentList({
    doctorId: doctorId || undefined,
    from: range.from,
    to: range.to,
    limit: 100, // API caps at 100
  });
  const items = apptData?.items || [];

  const byDate = useMemo(() => {
    const map = {};
    items.forEach((a) => { (map[localDateKey(a.appointmentDate)] ||= []).push(a); });
    return map;
  }, [items]);

  const inMonth = (key) => key.slice(0, 7) === month;
  const showBranch = !clinicId; // all clinics → tag each row with its branch

  const ApptRow = ({ a, compact }) => (
    <Link
      to={appointmentDetailPath(a.id)}
      className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 hover:bg-accent', compact ? 'text-[10px]' : 'text-sm')}
      title={`${a.patient?.fullName || 'Patient'} · ${APPOINTMENT_STATUS_LABELS[a.status]}${showBranch ? ' · ' + (branchName[a.branchId] || '') : ''}`}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[a.status] || 'bg-slate-400')} />
      <span className="font-mono text-muted-foreground">{a.startTime}</span>
      <span className="truncate font-medium">{a.patient?.fullName?.split(' ')[0] || 'Patient'}</span>
      {showBranch && a.branchId && (
        <span className="ml-auto flex items-center gap-1 truncate text-[10px] text-muted-foreground">
          <ColorDot id={a.branchId} />
          {branchName[a.branchId]}
        </span>
      )}
    </Link>
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to={APP_ROUTES.APPOINTMENTS}>← {t('appointments.title', 'Appointments')}</Link>
          </Button>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('appointments.calendar.title', 'Calendar')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border p-1">
            {['day', 'week', 'month'].map((v) => (
              <Button key={v} variant={view === v ? 'default' : 'ghost'} size="sm" onClick={() => setView(v)}>
                {t(`appointments.calendar.${v}`, v[0].toUpperCase() + v.slice(1))}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => go(-1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={goToday}>{t('appointments.calendar.today', 'Today')}</Button>
            <Button variant="outline" size="icon" onClick={() => go(1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="max-w-xs">
          <option value="">{t('appointments.calendar.allDoctors', 'All doctors')}</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>{d.user?.fullName || d.doctorCode}</option>
          ))}
        </Select>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1"><span className={cn('h-2 w-2 rounded-full', l.c)} />{l.label}</span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : view === 'day' ? (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <h2 className="font-display text-lg font-semibold">{day} · {(byDate[day] || []).length} {t('appointments.calendar.appointments', 'appointments')}</h2>
          {(byDate[day] || []).slice().sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1"><ApptRow a={a} /></div>
              <Badge variant={APPOINTMENT_STATUS_VARIANT[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
            </div>
          ))}
          {!(byDate[day] || []).length && <p className="text-sm text-muted-foreground">{t('appointments.calendar.noAppointmentsDay', 'No appointments this day.')}</p>}
        </div>
      ) : view === 'week' ? (
        <div className="grid gap-2 sm:grid-cols-7">
          {cells.map((dateKey) => (
            <div key={dateKey} className={cn('min-h-40 rounded-xl border bg-card p-2', dateKey === today && 'ring-1 ring-primary')}>
              <button type="button" className="mb-2 w-full text-left text-xs font-medium" onClick={() => { setDay(dateKey); setView('day'); }}>
                {DAY_NAMES[new Date(`${dateKey}T00:00:00`).getDay()]} {dateKey.slice(5)}
              </button>
              <div className="space-y-1">{(byDate[dateKey] || []).map((a) => <ApptRow key={a.id} a={a} compact />)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
            {DAY_NAMES.map((d) => (<div key={d} className="py-2">{d}</div>))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((dateKey) => {
              const appts = byDate[dateKey] || [];
              return (
                <div key={dateKey} className={cn('min-h-[104px] border-b border-r p-1', !inMonth(dateKey) && 'bg-muted/30 text-muted-foreground', dateKey === today && 'bg-primary/5')}>
                  <button type="button" onClick={() => { setDay(dateKey); setView('day'); }} className={cn('mb-1 block text-xs font-medium', dateKey === today && 'flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground')}>
                    {Number(dateKey.slice(8))}
                  </button>
                  <div className="space-y-0.5">
                    {appts.slice(0, 3).map((a) => <ApptRow key={a.id} a={a} compact />)}
                    {appts.length > 3 && <button type="button" onClick={() => { setDay(dateKey); setView('day'); }} className="text-[10px] text-primary">+{appts.length - 3} more</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
