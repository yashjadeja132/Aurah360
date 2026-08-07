import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserPlus, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { CheckInDialog } from '@/modules/reception/components/CheckInDialog';
import { WalkInDialog } from '@/modules/reception/components/WalkInDialog';
import { QueueBoard } from '@/modules/reception/components/QueueBoard';
import {
  useReceptionDashboard,
  useUndoCheckIn,
} from '@/modules/reception/hooks/useReception';
import { useQueueSocket } from '@/modules/reception/hooks/useQueueSocket';
import { APPOINTMENT_STATUS_LABELS } from '@/modules/appointments/constants';

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-primary">{value}</p>
    </div>
  );
}

export default function ReceptionDashboardPage() {
  const { t } = useTranslation();
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];
  const sortedBranches = useMemo(
    () => [...branches].sort((a, b) => String(a.branchCode || '').localeCompare(String(b.branchCode || ''))),
    [branches]
  );
  const [branchId, setBranchId] = useState('');
  const [search, setSearch] = useState('');
  const [checkInAppt, setCheckInAppt] = useState(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const effectiveBranchId = branchId || sortedBranches[0]?.id || '';
  const today = new Date().toISOString().slice(0, 10);

  useQueueSocket({ branchId: effectiveBranchId, enabled: Boolean(effectiveBranchId) });

  const { data, isLoading, isError, error } = useReceptionDashboard(effectiveBranchId, today);
  const undo = useUndoCheckIn();
  const { data: doctorsData } = useDoctorList({ limit: 50 });
  const doctors = doctorsData?.items || [];

  const payload = data?.data || {};
  const counts = payload.counts || {};
  const appointments = useMemo(() => {
    const list = payload.appointments || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a) =>
        a.appointmentNumber?.toLowerCase().includes(q) ||
        a.patient?.fullName?.toLowerCase().includes(q) ||
        a.patient?.mrn?.toLowerCase().includes(q) ||
        a.patient?.mobile?.includes(q)
    );
  }, [payload.appointments, search]);
  const queue = payload.queue || [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('reception.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('reception.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.QUEUE}>
              <ListOrdered className="h-4 w-4" />
              {t('reception.queueBoard')}
            </Link>
          </Button>
          <PermissionGuard permissions={[PERMISSIONS.RECEPTION_CHECKIN, PERMISSIONS.RECEPTION_ALL]}>
            <Button onClick={() => setWalkInOpen(true)} disabled={!effectiveBranchId}>
              <UserPlus className="h-4 w-4" />
              {t('reception.walkIn.button')}
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          value={effectiveBranchId}
          onChange={(e) => setBranchId(e.target.value)}
        >
          <option value="">{t('reception.filters.selectBranch')}</option>
          {sortedBranches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName || b.name}
            </option>
          ))}
        </Select>
        <Input
          placeholder={t('reception.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Stat label={t('reception.stats.today')} value={counts.total ?? 0} />
        <Stat label={t('reception.stats.checkedIn')} value={counts.checkedIn ?? 0} />
        <Stat label={t('reception.stats.waiting')} value={counts.waiting ?? 0} />
        <Stat label={t('reception.stats.inConsult')} value={counts.inConsultation ?? 0} />
        <Stat label={t('reception.stats.completed')} value={counts.completed ?? 0} />
        <Stat label={t('reception.stats.noShows')} value={counts.noShow ?? 0} />
        <Stat label={t('reception.stats.walkIns')} value={counts.walkIns ?? 0} />
        <Stat label={t('reception.stats.avgWait')} value={t('reception.minutesShort', { count: counts.averageWaitTime ?? 0 })} />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{t('reception.loading')}</p>}
      {isError && (
        <p className="text-sm text-destructive">{error?.response?.data?.message || t('reception.failedToLoad')}</p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold">{t('reception.todaysAppointments')}</h2>
          <div className="space-y-2">
            {appointments.map((appt) => (
              <div
                key={appt.id}
                className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {appt.startTime} · {appt.patient?.fullName || t('reception.patient')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {appt.appointmentNumber} · {t('reception.doctorPrefix')} {appt.doctor?.name || '—'} ·{' '}
                    {APPOINTMENT_STATUS_LABELS[appt.status] || appt.status}
                    {appt.isLate ? ` · ${t('reception.late')}` : ''}
                    {appt.source === 'WALK_IN' ? ` · ${t('reception.walkIn.label')}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['SCHEDULED', 'CONFIRMED'].includes(appt.status) && (
                    <PermissionGuard
                      permissions={[PERMISSIONS.RECEPTION_CHECKIN, PERMISSIONS.RECEPTION_ALL]}
                    >
                      <Button size="sm" onClick={() => setCheckInAppt(appt)}>
                        {t('reception.checkIn.button')}
                      </Button>
                    </PermissionGuard>
                  )}
                  {appt.status === 'CHECKED_IN' && (
                    <PermissionGuard
                      permissions={[PERMISSIONS.RECEPTION_CHECKIN, PERMISSIONS.RECEPTION_ALL]}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => undo.mutate(appt.id)}
                        disabled={undo.isPending}
                      >
                        {t('reception.checkIn.undo')}
                      </Button>
                    </PermissionGuard>
                  )}
                </div>
              </div>
            ))}
            {!appointments.length && !isLoading && (
              <p className="text-sm text-muted-foreground">{t('reception.noAppointmentsToday')}</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-xl font-semibold">{t('reception.liveQueue')}</h2>
          <QueueBoard entries={queue} doctors={doctors} />
        </div>
      </div>

      <CheckInDialog
        open={Boolean(checkInAppt)}
        onOpenChange={(o) => !o && setCheckInAppt(null)}
        appointment={checkInAppt}
      />
      <WalkInDialog
        open={walkInOpen}
        onOpenChange={setWalkInOpen}
        branchId={effectiveBranchId}
      />
    </section>
  );
}
