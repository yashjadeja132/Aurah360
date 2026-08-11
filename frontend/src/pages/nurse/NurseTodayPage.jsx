import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HeartPulse, ListOrdered, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState } from '@/components/common/EmptyState';
import { QueueStatusBadge, PriorityBadge, WaitingTimer } from '@/modules/reception/components/QueueBadges';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useBranchQueue, useQueueSummary } from '@/modules/reception/hooks/useReception';
import { useQueueSocket } from '@/modules/reception/hooks/useQueueSocket';
import { useAuth } from '@/contexts/AuthContext';
import { APP_ROUTES, patientDetailPath } from '@/constants/routes';
import { ROLES } from '@/constants/rbac';

// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES. QueueController's SEC-030
// note: branch comes from the caller's token for every non-OWNER/ADMIN role — so a NURSE
// picking a different branch here wouldn't get 403'd, it would silently keep seeing their own
// branch's queue while the dropdown claims otherwise. Lock the picker for branch-scoped roles.
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];
// 'Today' must come from the LOCAL calendar day — see QueueDashboardPage/DoctorMyDayPage for the
// same note: a UTC slice returns yesterday between 00:00 and 05:30 IST.
import { todayKey } from '@/utils/date';

/**
 * Nurse landing screen — the patient queue the nurse actually works off, not the full reception
 * board (no call/skip/reorder controls — those stay reception's job; NURSE only holds
 * `queue.view`, not `queue.manage`) and not the doctor's per-appointment "My day" (that view is
 * appointment-centric; a nurse's day is queue-centric — who is waiting, right now, at this branch).
 *
 * NOTE ON THE "NEEDS: VITALS / HISTORY / PHOTO / PATCH TEST" CHIP ASKED FOR IN THE BRIEF —
 * intentionally NOT built here. The branch-queue endpoint (`GET /queue/branch/:branchId`, via
 * `useBranchQueue`) returns token/doctor/priority/wait-time fields only — no consultationId, no
 * vitals-recorded flag, no photo/patch-test-pending flag per entry. Deriving that chip honestly
 * would mean firing one extra request per queued patient (consultation + patch-test lookups),
 * which doesn't scale on a board that refreshes continuously, or inventing the flag client-side,
 * which is exactly the "fake data" the brief says not to do. A real chip needs the queue (or a new
 * aggregate) endpoint to embed a `readiness: { vitals, history, photo, patchTest }` summary per
 * entry — that's backend work, flagged here rather than faked.
 */
export default function NurseTodayPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];
  const sortedBranches = useMemo(
    () => [...branches].sort((a, b) => String(a.branchCode || '').localeCompare(String(b.branchCode || ''))),
    [branches]
  );
  const [branchId, setBranchId] = useState('');
  const effectiveBranchId = isGlobalScope
    ? branchId || sortedBranches[0]?.id || ''
    : user?.branch || '';
  const ownBranchName =
    sortedBranches.find((b) => String(b.id) === String(effectiveBranchId))?.displayName ||
    sortedBranches.find((b) => String(b.id) === String(effectiveBranchId))?.name ||
    null;
  const today = todayKey();

  useQueueSocket({ branchId: effectiveBranchId, enabled: Boolean(effectiveBranchId) });

  const { data: queueRes, isLoading } = useBranchQueue(effectiveBranchId, today);
  const { data: summaryRes } = useQueueSummary(effectiveBranchId, today);
  const { data: doctorsData } = useDoctorList({ limit: 50 });
  const doctors = doctorsData?.items || [];

  const entries = queueRes?.data || [];
  const summary = summaryRes?.data || {};

  const active = useMemo(
    () => entries.filter((e) => !['COMPLETED', 'CANCELLED'].includes(e.queueStatus)),
    [entries]
  );

  return (
    <section className="space-y-6">
      <PageHeader
        icon={HeartPulse}
        title={t('nurse.today.title', "Today's queue")}
        description={t(
          'nurse.today.subtitle',
          'The patients waiting at your branch right now — open a patient to record vitals, history or clinical photos.'
        )}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to={APP_ROUTES.QUEUE}>
              <ListOrdered className="h-4 w-4" />
              {t('nurse.today.fullQueue', 'Full queue board')}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isGlobalScope ? (
          <Select value={effectiveBranchId} onChange={(e) => setBranchId(e.target.value)} className="lg:col-span-1">
            <option value="">{t('reception.filters.selectBranch', 'Select branch')}</option>
            {sortedBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName || b.name}
              </option>
            ))}
          </Select>
        ) : (
          <Badge variant="outline" className="lg:col-span-1 justify-center px-3 py-1.5 text-sm font-medium">
            {ownBranchName || t('nurse.today.yourBranch', 'Your branch')}
          </Badge>
        )}
        <StatCard
          label={t('reception.stats.waiting', 'Waiting')}
          value={summary.counts?.waiting ?? 0}
          icon={Users}
        />
        <StatCard
          label={t('reception.stats.currentToken', 'Current token')}
          value={summary.currentToken || '—'}
        />
        <StatCard
          label={t('reception.stats.completed', 'Completed')}
          value={summary.counts?.completed ?? 0}
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{t('reception.queue.loading', 'Loading queue…')}</p>}

      {!isLoading && !active.length && (
        <EmptyState
          icon={HeartPulse}
          title={t('nurse.today.empty', 'No patients waiting')}
          description={t('nurse.today.emptyHint', 'Checked-in patients for this branch will appear here.')}
        />
      )}

      <ul className="space-y-2">
        {active.map((entry) => {
          const doctor = doctors.find((d) => d.id === entry.doctorId);
          const patientId = entry.patient?.id || entry.patientId;
          return (
            <li
              key={entry.id}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-xl font-bold tracking-tight text-primary">
                    {entry.tokenNumber}
                  </span>
                  <QueueStatusBadge status={entry.queueStatus} />
                  <PriorityBadge priority={entry.priority} />
                  {entry.isWalkIn && <Badge variant="secondary">{t('reception.walkIn.label', 'Walk-in')}</Badge>}
                </div>
                <p className="font-medium">
                  {entry.patient?.fullName || t('reception.patient', 'Patient')}{' '}
                  <span className="text-muted-foreground">({entry.patient?.mrn})</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('reception.doctorPrefix', 'Dr.')} {doctor?.user?.fullName || entry.doctor?.name || '—'} ·{' '}
                  <WaitingTimer arrivalTime={entry.arrivalTime} />
                </p>
              </div>

              {patientId && (
                <Button asChild size="sm" variant="outline">
                  <Link to={patientDetailPath(patientId)}>
                    {t('nurse.today.openPatient', 'Open patient')}
                  </Link>
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
