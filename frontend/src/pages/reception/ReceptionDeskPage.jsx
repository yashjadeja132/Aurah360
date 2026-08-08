import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarPlus,
  ClipboardList,
  Clock,
  ConciergeBell,
  ListOrdered,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { QueryState } from '@/components/common/QueryState';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { hasAnyPermission } from '@/utils/permissions';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { APPOINTMENT_STATUS_LABELS } from '@/modules/appointments/constants';
import { formatMoney } from '@/modules/billing/constants';
import { CheckInDialog } from '@/modules/reception/components/CheckInDialog';
import { WalkInDialog } from '@/modules/reception/components/WalkInDialog';
import { QueueBoard } from '@/modules/reception/components/QueueBoard';
import { NeedsAttentionPanel } from '@/modules/reception/components/NeedsAttentionPanel';
import { useQueueSocket } from '@/modules/reception/hooks/useQueueSocket';
import { useUndoCheckIn } from '@/modules/reception/hooks/useReception';
import {
  useBranchesIfPermitted,
  useReceptionDesk,
} from '@/modules/reception/hooks/useReceptionDesk';

const CHECK_IN_ABLE = ['SCHEDULED', 'CONFIRMED'];

/**
 * A.1 — the receptionist's landing: the front desk's whole day on ONE screen.
 *
 * The flow diff (row A1) says the existing `ReceptionDashboardPage` is "a flat stat-tiles + two-list
 * dashboard" with "no 'needs attention now' ranked list … no missing-document/consent chip, no
 * quick-action shortcut palette on the dashboard itself". This screen composes the same panels plus
 * the three things that were missing, and every action resolves in place:
 *
 *   1. Quick actions (walk-in, register, book, queue board) in the header — no hunting through nav.
 *   2. A ranked "needs attention now" list with inline Check in / Call / Collect / Record consent.
 *   3. The live queue and the day sheet, both with their actions attached.
 *
 * No new backend endpoint: see `useReceptionDesk` for how each panel maps onto an existing route.
 */
export default function ReceptionDeskPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const permissions = user?.permissions;

  const canListBranches = hasAnyPermission(permissions, [
    PERMISSIONS.BRANCHES_VIEW,
    PERMISSIONS.BRANCHES_ALL,
  ]);
  const canViewBilling = hasAnyPermission(permissions, [
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_ALL,
  ]);
  const canViewConsent = hasAnyPermission(permissions, [
    PERMISSIONS.CONSENT_VIEW,
    PERMISSIONS.CONSENT_ALL,
  ]);

  /**
   * RBAC: `GET /branches` requires `branches.view`, which the RECEPTIONIST role does NOT hold — so
   * the branch picker is only mounted for users who can actually read the list, and everyone else
   * is scoped to their own `user.branch` (which the /auth/me payload always carries). Without this,
   * the screen 403s for the exact role it is built for.
   */
  const branchQuery = useBranchesIfPermitted(canListBranches);
  const branches = branchQuery.data?.items || [];
  const sortedBranches = useMemo(
    () =>
      [...branches].sort((a, b) =>
        String(a.branchCode || '').localeCompare(String(b.branchCode || ''))
      ),
    [branches]
  );

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const branchId = selectedBranchId || user?.branch || sortedBranches[0]?.id || '';

  const [search, setSearch] = useState('');
  const [checkInAppt, setCheckInAppt] = useState(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  useQueueSocket({ branchId, enabled: Boolean(branchId) });

  const desk = useReceptionDesk({ branchId, canViewConsent, canViewBilling });
  const undo = useUndoCheckIn();

  // `doctors.view` IS held by RECEPTIONIST, so this list is always safe to read here.
  const doctorQuery = useDoctorList({ limit: 50 });
  const doctors = doctorQuery.data?.items || [];

  const daySheet = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return desk.appointments;
    return desk.appointments.filter(
      (a) =>
        a.appointmentNumber?.toLowerCase().includes(q) ||
        a.patient?.fullName?.toLowerCase().includes(q) ||
        a.patient?.mrn?.toLowerCase().includes(q) ||
        a.patient?.mobile?.includes(q)
    );
  }, [desk.appointments, search]);

  const counts = desk.counts;

  return (
    <section>
      <PageHeader
        icon={ConciergeBell}
        title={t('receptionDesk.title', 'Front desk')}
        description={t(
          'receptionDesk.subtitle',
          "Everything your day needs, on this screen — who to chase right now, the live queue, and the full day sheet, each with its action attached."
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PermissionGuard permissions={[PERMISSIONS.PATIENTS_CREATE, PERMISSIONS.PATIENTS_ALL]}>
              <Button asChild variant="outline">
                <Link to={APP_ROUTES.PATIENT_CREATE}>
                  <Users className="h-4 w-4" />
                  {t('receptionDesk.actions.register', 'Register patient')}
                </Link>
              </Button>
            </PermissionGuard>
            <PermissionGuard
              permissions={[PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_ALL]}
            >
              <Button asChild variant="outline">
                <Link to={APP_ROUTES.APPOINTMENT_BOOK}>
                  <CalendarPlus className="h-4 w-4" />
                  {t('receptionDesk.actions.book', 'Book')}
                </Link>
              </Button>
            </PermissionGuard>
            <Button asChild variant="outline">
              <Link to={APP_ROUTES.QUEUE}>
                <ListOrdered className="h-4 w-4" />
                {t('receptionDesk.actions.queueBoard', 'Queue board')}
              </Link>
            </Button>
            <PermissionGuard permissions={[PERMISSIONS.RECEPTION_CHECKIN, PERMISSIONS.RECEPTION_ALL]}>
              <Button onClick={() => setWalkInOpen(true)} disabled={!branchId}>
                <UserPlus className="h-4 w-4" />
                {t('receptionDesk.actions.walkIn', 'Walk-in')}
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          {canListBranches && (
            <Select
              value={branchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="sm:w-64"
            >
              <option value="">{t('receptionDesk.filters.selectBranch', 'Select branch')}</option>
              {sortedBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName || b.name}
                </option>
              ))}
            </Select>
          )}
          <Input
            className="sm:max-w-sm"
            placeholder={t('receptionDesk.searchPlaceholder', 'Search name, MRN, mobile or appointment no.')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={ClipboardList}
            label={t('receptionDesk.stats.today', 'Appointments today')}
            value={String(counts.total ?? 0)}
            hint={t('receptionDesk.stats.todayHint', '{{checkedIn}} checked in · {{completed}} done · {{noShow}} no-show', {
              checkedIn: counts.checkedIn ?? 0,
              completed: counts.completed ?? 0,
              noShow: counts.noShow ?? 0,
            })}
          />
          <StatCard
            icon={Clock}
            label={t('receptionDesk.stats.waiting', 'Waiting now')}
            value={String(counts.waiting ?? 0)}
            tone={desk.longestWait >= 20 ? 'destructive' : 'default'}
            hint={t('receptionDesk.stats.waitingHint', 'Longest wait {{longest}} min · average {{avg}} min', {
              longest: desk.longestWait,
              avg: counts.averageWaitTime ?? 0,
            })}
          />
          <StatCard
            icon={ConciergeBell}
            label={t('receptionDesk.stats.inConsult', 'In consultation')}
            value={String(counts.inConsultation ?? 0)}
            tone="info"
            hint={t('receptionDesk.stats.walkInsHint', '{{count}} walk-in(s) today', {
              count: counts.walkIns ?? 0,
            })}
          />
          {canViewBilling ? (
            <StatCard
              icon={ClipboardList}
              label={t('receptionDesk.stats.duesAtDesk', 'Dues at the desk')}
              value={formatMoney(desk.dues.outstanding)}
              tone={desk.dues.count ? 'warning' : 'default'}
              hint={t('receptionDesk.stats.duesHint', '{{count}} patient(s) here today owe money', {
                count: desk.dues.count,
              })}
            />
          ) : (
            <StatCard
              icon={ClipboardList}
              label={t('receptionDesk.stats.consentGaps', 'Consent gaps')}
              value={desk.consent.isEnabled ? String(desk.consent.missingCount) : '—'}
              tone={desk.consent.missingCount ? 'warning' : 'default'}
              hint={
                desk.consent.isEnabled
                  ? t('receptionDesk.stats.consentHint', 'Checked {{count}} patient(s) present now', {
                      count: desk.consent.checked,
                    })
                  : t(
                      'receptionDesk.stats.consentNotConfigured',
                      'No consent form has been published yet'
                    )
              }
            />
          )}
        </div>

        {/*
          Nothing loads without a branch. A user who can list branches picks one above; a user who
          cannot (RECEPTIONIST) is scoped to `user.branch` — and that field is genuinely null on some
          accounts, so say so plainly instead of rendering a silently empty desk.
        */}
        {!branchId ? (
          <EmptyState
            icon={ConciergeBell}
            title={t('receptionDesk.noBranchTitle', 'No branch assigned')}
            description={
              canListBranches
                ? t('receptionDesk.noBranchPick', 'Choose a branch above to load the front desk.')
                : t(
                    'receptionDesk.noBranchAssigned',
                    'Your account is not linked to a branch, so there is no day sheet to show. Ask an administrator to set your branch.'
                  )
            }
          />
        ) : (
        <QueryState
          isLoading={desk.isLoading}
          isError={desk.isError}
          error={desk.error}
          onRetry={desk.refetch}
        >
          <div className="space-y-6">
            <NeedsAttentionPanel
              rows={desk.attention}
              isLoading={desk.isLoading}
              onCheckIn={setCheckInAppt}
            />

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {t('receptionDesk.daySheet.title', "Today's appointments")}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {t('receptionDesk.daySheet.count', '{{count}} shown', { count: daySheet.length })}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {daySheet.length === 0 ? (
                    <EmptyState
                      icon={ClipboardList}
                      title={t('receptionDesk.daySheet.emptyTitle', 'Nothing on the day sheet')}
                      description={t(
                        'receptionDesk.daySheet.emptyDescription',
                        'No appointment matches this branch, date and search.'
                      )}
                    />
                  ) : (
                    <ul className="divide-y">
                      {daySheet.map((appt) => (
                        <li
                          key={appt.id}
                          className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              <span className="tabular-nums text-muted-foreground">
                                {appt.startTime || '—'}
                              </span>{' '}
                              {appt.patient?.fullName || t('receptionDesk.daySheet.patient', 'Patient')}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {appt.appointmentNumber} ·{' '}
                              {appt.doctor?.name || t('receptionDesk.daySheet.noDoctor', 'No doctor')} ·{' '}
                              {APPOINTMENT_STATUS_LABELS[appt.status] || appt.status}
                              {appt.source === 'WALK_IN'
                                ? ` · ${t('receptionDesk.daySheet.walkIn', 'Walk-in')}`
                                : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {appt.isLate && (
                              <Badge variant="warning">
                                {t('receptionDesk.daySheet.late', 'Late')}
                              </Badge>
                            )}
                            {CHECK_IN_ABLE.includes(appt.status) && (
                              <PermissionGuard
                                permissions={[PERMISSIONS.RECEPTION_CHECKIN, PERMISSIONS.RECEPTION_ALL]}
                              >
                                <Button size="sm" onClick={() => setCheckInAppt(appt)}>
                                  {t('receptionDesk.daySheet.checkIn', 'Check in')}
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
                                  disabled={undo.isPending}
                                  onClick={() => undo.mutate(appt.id)}
                                >
                                  {t('receptionDesk.daySheet.undo', 'Undo check-in')}
                                </Button>
                              </PermissionGuard>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-3">
                <h2 className="font-display text-xl font-semibold">
                  {t('receptionDesk.liveQueue', 'Live queue')}
                </h2>
                <QueueBoard entries={desk.queue} doctors={doctors} />
              </div>
            </div>
          </div>
        </QueryState>
        )}
      </div>

      <CheckInDialog
        open={Boolean(checkInAppt)}
        onOpenChange={(open) => !open && setCheckInAppt(null)}
        appointment={checkInAppt}
      />
      <WalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} branchId={branchId} />
    </section>
  );
}
