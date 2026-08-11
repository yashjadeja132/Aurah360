import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SearchableCombobox } from '@/components/common/SearchableCombobox';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { useAuth } from '@/contexts/AuthContext';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useMasterActive } from '@/modules/masters/hooks/useMasters';
import { useDoctorCalendar } from '@/modules/appointments/hooks/useAppointments';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_VARIANT,
  STATUS_OPTIONS,
} from '@/modules/appointments/constants';
import { APP_ROUTES, appointmentDetailPath } from '@/constants/routes';
import { ROLES } from '@/constants/rbac';
import { cn } from '@/utils/cn';
// Every date in this screen is a CALENDAR DAY, not an instant: `appointmentDate` is persisted as
// local start-of-day, so in IST it arrives as `…T18:30:00.000Z` — the PREVIOUS UTC date. The old
// `toISOString().slice(0, 10)` bucketing therefore filed every appointment one column to the left.
// See `@/utils/date`.
import {
  addDaysKey,
  getMonthGridKeys,
  localDateKey,
  startOfMonthKey,
  startOfWeek,
  startOfWeekKey,
} from '@/utils/date';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** APT-001 §6.2 — mirrors AppointmentConflictService's DEFAULT_TRAVEL_BUFFER_MINUTES; this panel
 * re-derives conflicts client-side from the appointments already on screen (see notes below on
 * why there's no dedicated backend endpoint for this yet). */
const TRAVEL_BUFFER_MINUTES = 30;

function timeToMinutes(t) {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return h * 60 + m;
}

/**
 * Re-derives the same overlap / cross-branch travel-buffer rules AppointmentConflictService
 * enforces server-side on write, but read-only and over the appointments already fetched for the
 * visible range — there is no backend endpoint yet that surfaces the service's conflict checks
 * for a whole range (only single-candidate assertions used during booking/reschedule). Since a
 * doctor's calendar already carries every appointment (incl. branch) needed to repeat the same
 * comparisons, doing it here avoids adding new backend surface area for something we can compute
 * from data already on hand.
 */
function computeConflicts(items) {
  const byDate = {};
  items.forEach((a) => {
    const key = localDateKey(a.appointmentDate);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(a);
  });

  const conflicts = [];
  Object.entries(byDate).forEach(([dateKey, dayItems]) => {
    for (let i = 0; i < dayItems.length; i += 1) {
      for (let j = i + 1; j < dayItems.length; j += 1) {
        const a = dayItems[i];
        const b = dayItems[j];
        const aStart = timeToMinutes(a.startTime);
        const aEnd = timeToMinutes(a.endTime);
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        const overlaps = aStart < bEnd && aEnd > bStart;
        if (overlaps) {
          conflicts.push({ type: 'OVERLAP', dateKey, a, b });
          continue;
        }
        const sameBranch = a.branchId && b.branchId && a.branchId === b.branchId;
        if (!sameBranch && a.branchId && b.branchId) {
          const gap = aStart <= bStart ? bStart - aEnd : aStart - bEnd;
          if (gap < TRAVEL_BUFFER_MINUTES) {
            conflicts.push({ type: 'TRAVEL_BUFFER', dateKey, a, b, gap });
          }
        }
      }
    }
  });
  return conflicts;
}

export default function AppointmentCalendarPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Same fix as ConsultationListPage.jsx et al. — a DOCTOR must not be offered a picker over
  // every other doctor's appointment calendar (patient names included). Backend already
  // 403s/404s a DOCTOR requesting someone else's doctorId (AppointmentController#doctorCalendar
  // via scope.helper.js#resolveDoctorScope).
  const isDoctorRole = user?.role === ROLES.DOCTOR;
  const { data: doctorsData } = useDoctorList({ limit: 50, isActive: 'true' });
  const doctors = isDoctorRole ? [] : doctorsData?.items || [];
  const [doctorId, setDoctorId] = useState('');
  const [weekStart, setWeekStart] = useState(startOfWeekKey());
  // Spec: day view is the default landing view for the appointments calendar.
  const [view, setView] = useState('day');
  const [day, setDay] = useState(localDateKey());
  const [monthStart, setMonthStart] = useState(startOfMonthKey());

  // Filters — applied client-side to the already-fetched `items`; the doctor-calendar endpoint
  // doesn't take branch/service/status query params (see useDoctorCalendar / appointmentsApi).
  const { data: branchesData } = useBranchList({ limit: 100 });
  const branches = branchesData?.items || [];
  const { data: services = [] } = useMasterActive('services');
  const [branchFilter, setBranchFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showConflicts, setShowConflicts] = useState(false);

  const activeDoctor = isDoctorRole ? undefined : doctorId || doctors[0]?.id || '';

  const range = useMemo(() => {
    if (view === 'day') {
      return { from: day, to: day };
    }
    if (view === 'month') {
      const grid = getMonthGridKeys(monthStart);
      return { from: grid[0], to: grid[grid.length - 1] };
    }
    // week & list share the same underlying weekly range.
    const start = startOfWeek(weekStart);
    return {
      from: localDateKey(start),
      to: addDaysKey(6, start),
    };
  }, [view, weekStart, day, monthStart]);

  const { data: items = [], isLoading } = useDoctorCalendar(
    { doctorId: activeDoctor, from: range.from, to: range.to },
    activeDoctor !== ''
  );

  const filteredItems = useMemo(
    () =>
      items.filter((a) => {
        if (branchFilter && a.branchId !== branchFilter) return false;
        if (serviceFilter && a.serviceId !== serviceFilter) return false;
        if (statusFilter && a.status !== statusFilter) return false;
        return true;
      }),
    [items, branchFilter, serviceFilter, statusFilter]
  );

  const byDate = useMemo(() => {
    const map = {};
    filteredItems.forEach((a) => {
      const key = localDateKey(a.appointmentDate);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [filteredItems]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(weekStart);
    return Array.from({ length: 7 }, (_, i) => addDaysKey(i, start));
  }, [weekStart]);

  const monthDays = useMemo(() => getMonthGridKeys(monthStart), [monthStart]);
  const monthLabel = useMemo(() => {
    const d = new Date(`${monthStart}T00:00:00`);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [monthStart]);

  // Multi-branch relevance: only worth a badge on cards when the visible range actually spans
  // more than one branch (e.g. reception/admin viewing across branches) — a DOCTOR's own
  // schedule is typically single-branch and a badge that never varies is just noise.
  const showBranchBadge = useMemo(
    () => new Set(filteredItems.map((a) => a.branchId).filter(Boolean)).size > 1,
    [filteredItems]
  );

  const conflicts = useMemo(
    () => (showConflicts ? computeConflicts(filteredItems) : []),
    [showConflicts, filteredItems]
  );

  const listItems = useMemo(
    () =>
      [...filteredItems].sort((a, b) => {
        const dateCmp = localDateKey(a.appointmentDate).localeCompare(localDateKey(b.appointmentDate));
        return dateCmp !== 0 ? dateCmp : a.startTime.localeCompare(b.startTime);
      }),
    [filteredItems]
  );

  function renderAppointmentRow(a) {
    return (
      <Link
        key={a.id}
        to={appointmentDetailPath(a.id)}
        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm hover:bg-accent"
        style={a.doctor?.colorCode ? { borderLeftColor: a.doctor.colorCode, borderLeftWidth: 4 } : undefined}
      >
        <div>
          <p className="font-medium">
            {a.startTime}–{a.endTime} · {a.patient?.fullName}
          </p>
          <p className="text-xs text-muted-foreground">
            {a.service?.name} · {a.appointmentNumber}
            {view === 'list' && ` · ${localDateKey(a.appointmentDate)}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {showBranchBadge && a.branch?.name && (
            <Badge variant="outline">{a.branch.name}</Badge>
          )}
          <Badge variant={APPOINTMENT_STATUS_VARIANT[a.status]}>
            {APPOINTMENT_STATUS_LABELS[a.status]}
          </Badge>
        </div>
      </Link>
    );
  }

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
          <Button variant={view === 'month' ? 'default' : 'outline'} size="sm" onClick={() => setView('month')}>
            {t('appointments.calendar.monthly', 'Monthly')}
          </Button>
          <Button variant={view === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setView('week')}>
            {t('appointments.calendar.weekly', 'Weekly')}
          </Button>
          <Button variant={view === 'day' ? 'default' : 'outline'} size="sm" onClick={() => setView('day')}>
            {t('appointments.calendar.daily', 'Daily')}
          </Button>
          <Button variant={view === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setView('list')}>
            {t('appointments.calendar.list', 'List')}
          </Button>
          <Button variant={showConflicts ? 'default' : 'outline'} size="sm" onClick={() => setShowConflicts((v) => !v)}>
            {t('appointments.calendar.conflicts', 'Conflicts')}
          </Button>
          <PermissionGuard permissions={[PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_ALL]}>
            <Button asChild size="sm">
              <Link to={APP_ROUTES.APPOINTMENT_BOOK}>
                <Plus className="h-4 w-4" />
                {t('appointments.calendar.addAppointment', '+ Add appointment')}
              </Link>
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {!isDoctorRole && (
          <SearchableCombobox
            value={activeDoctor}
            onChange={setDoctorId}
            options={doctors}
            filterKeys={['doctorCode']}
            renderLabel={(d) => d.user?.fullName || d.doctorCode}
            placeholder={t('appointments.calendar.selectDoctor', 'Select doctor')}
            emptyText={t('appointments.calendar.noDoctorMatch', 'No doctor matches')}
          />
        )}
        {view === 'month' ? (
          <Input type="month" value={monthStart.slice(0, 7)} onChange={(e) => setMonthStart(`${e.target.value}-01`)} />
        ) : view === 'day' ? (
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        ) : (
          <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
        )}
        <Select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">{t('appointments.calendar.allBranches', 'All branches')}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
          ))}
        </Select>
        <Select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
          <option value="">{t('appointments.calendar.allServices', 'All services')}</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">{t('appointments.calendar.allStatuses', 'All statuses')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{APPOINTMENT_STATUS_LABELS[s]}</option>
          ))}
        </Select>
      </div>

      {showConflicts && (
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-display text-lg font-semibold">
            {t('appointments.calendar.conflictsTitle', 'Conflicts in view')}
          </h2>
          {!conflicts.length ? (
            <p className="text-sm text-muted-foreground">
              {t('appointments.calendar.noConflicts', 'No overlaps or travel-buffer violations detected in the visible range.')}
            </p>
          ) : (
            <ul className="space-y-2">
              {conflicts.map((c, idx) => (
                <li key={idx} className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
                  <Badge variant="destructive" className="mr-2">
                    {c.type === 'OVERLAP'
                      ? t('appointments.calendar.overlap', 'Overlap')
                      : t('appointments.calendar.travelBuffer', 'Travel buffer')}
                  </Badge>
                  {c.dateKey} · {c.a.appointmentNumber} ({c.a.startTime}–{c.a.endTime}) vs{' '}
                  {c.b.appointmentNumber} ({c.b.startTime}–{c.b.endTime})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : view === 'month' ? (
        <div className="space-y-2">
          <h2 className="font-display text-lg font-semibold">{monthLabel}</h2>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {DAY_NAMES.map((n) => (
              <div key={n}>{n}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((dateKey) => {
              const inMonth = dateKey.slice(0, 7) === monthStart.slice(0, 7);
              const count = (byDate[dateKey] || []).length;
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => { setDay(dateKey); setView('day'); }}
                  className={cn(
                    'min-h-16 rounded-lg border p-1.5 text-left text-xs hover:bg-accent',
                    !inMonth && 'text-muted-foreground/50'
                  )}
                >
                  <div>{Number(dateKey.slice(8, 10))}</div>
                  {count > 0 && (
                    <Badge variant="secondary" className="mt-1">
                      {count}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : view === 'week' ? (
        <div className="grid gap-2 sm:grid-cols-7">
          {weekDays.map((dateKey) => (
            <div key={dateKey} className="min-h-40 rounded-xl border bg-card p-2">
              <button
                type="button"
                className="mb-2 w-full text-left text-xs font-medium"
                onClick={() => { setDay(dateKey); setView('day'); }}
              >
                {/* `new Date('2026-08-03')` parses as UTC midnight; appending a time forces the
                    LOCAL calendar day so the weekday label can't drift off the column's date. */}
                {DAY_NAMES[new Date(`${dateKey}T00:00:00`).getDay()]} {dateKey.slice(5)}
              </button>
              <div className="space-y-1">
                {(byDate[dateKey] || []).map((a) => (
                  <Link
                    key={a.id}
                    to={appointmentDetailPath(a.id)}
                    className={cn('block rounded-md border px-1.5 py-1 text-[10px] hover:bg-accent')}
                    style={a.doctor?.colorCode ? { borderLeftColor: a.doctor.colorCode, borderLeftWidth: 3 } : undefined}
                  >
                    <span className="font-mono">{a.startTime}</span>{' '}
                    {a.patient?.fullName?.split(' ')[0]}
                    <Badge className="ml-1" variant={APPOINTMENT_STATUS_VARIANT[a.status]}>
                      {a.status.slice(0, 3)}
                    </Badge>
                  </Link>
                ))}
                {!(byDate[dateKey] || []).length && (
                  <p className="text-[11px] text-muted-foreground">
                    {t('appointments.calendar.noAppointmentsDay', 'No appointments available')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : view === 'list' ? (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <h2 className="font-display text-lg font-semibold">
            {range.from} → {range.to} ·{' '}
            {t('appointments.calendar.appointmentsCount', '{{count}} appointments', { count: listItems.length })}
          </h2>
          {listItems.map(renderAppointmentRow)}
          {!listItems.length && (
            <p className="text-sm text-muted-foreground">
              {t('appointments.calendar.noAppointmentsRange', 'No appointments in this range.')}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border bg-card p-4">
          <h2 className="font-display text-lg font-semibold">
            {day} · {t('appointments.calendar.appointmentsCount', '{{count}} appointments', { count: (byDate[day] || []).length })}
          </h2>
          {(byDate[day] || [])
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map(renderAppointmentRow)}
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
