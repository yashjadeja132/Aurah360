import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAppointmentList } from '@/modules/appointments/hooks/useAppointments';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_VARIANT } from '@/modules/appointments/constants';
import { appointmentDetailPath } from '@/constants/routes';
import { useClinicId } from '@/stores/clinicStore';
import { todayKey } from '@/utils/date';

function Kpi({ icon: Icon, label, value, tone }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}

/** Trueatoms-style appointment glance: 4 KPIs + today's schedule, all clinics by default. */
export function TodayOverview() {
  const { t } = useTranslation();
  const clinicId = useClinicId();
  const today = todayKey();
  const { data } = useAppointmentList({ branchId: clinicId || undefined, from: today, to: today, limit: 500 });
  const items = data?.items || [];

  const stats = useMemo(() => {
    const s = { total: items.length, completed: 0, pending: 0, cancelled: 0 };
    for (const a of items) {
      if (a.status === 'COMPLETED') s.completed += 1;
      else if (a.status === 'CANCELLED' || a.status === 'NO_SHOW') s.cancelled += 1;
      else s.pending += 1;
    }
    return s;
  }, [items]);

  const schedule = useMemo(
    () => items.slice().sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [items]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={CalendarDays} label={t('owner.today.appointments', "Today's appointments")} value={stats.total} tone="bg-primary/10 text-primary" />
        <Kpi icon={CheckCircle2} label={t('owner.today.completed', 'Completed')} value={stats.completed} tone="bg-success-soft text-success" />
        <Kpi icon={Clock} label={t('owner.today.pending', 'Pending')} value={stats.pending} tone="bg-warning-soft text-warning" />
        <Kpi icon={XCircle} label={t('owner.today.cancelled', 'Cancelled / no-show')} value={stats.cancelled} tone="bg-muted text-muted-foreground" />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{t('owner.today.schedule', "Today's schedule")}</h2>
          <span className="text-sm text-muted-foreground">{stats.total} {t('owner.today.appts', 'appointments')}</span>
        </div>
        <div className="space-y-1.5">
          {schedule.map((a) => (
            <Link
              key={a.id}
              to={appointmentDetailPath(a.id)}
              className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">{a.startTime}</span>
                <div>
                  <p className="font-medium">{a.patient?.fullName || t('owner.today.patient', 'Patient')}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.doctor?.user?.fullName || a.doctor?.name || '—'} · {a.appointmentNumber}
                  </p>
                </div>
              </div>
              <Badge variant={APPOINTMENT_STATUS_VARIANT[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
            </Link>
          ))}
          {!schedule.length && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {t('owner.today.empty', 'No appointments scheduled today.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TodayOverview;
