import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Activity, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import {
  useSessions,
  useStartSession,
} from '@/modules/treatmentSessions/hooks/useTreatmentSessions';
import { SessionPreflightPanel } from '@/modules/treatmentSessions/components/SessionPreflightPanel';
import { SessionReadinessCell } from '@/modules/treatmentSessions/components/SessionReadinessCell';
import { SESSION_STATUS_LABELS } from '@/modules/treatmentSessions/constants';
import { APP_ROUTES, treatmentSessionPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

/** Only these two statuses can be started, so only these belong on a "ready to start" worklist. */
const STARTABLE_STATUSES = ['SCHEDULED', 'CHECKED_IN'];

/**
 * How many rows fetch their pre-flight eagerly. Pre-flight is per-session
 * (`GET /treatment-sessions/:id/preflight`, no batch variant exists), so an unbounded list would
 * fan out one request per row. The worklist is already narrowed to startable sessions and sorted
 * newest-first; the technician acts on the top of it, so the top slice is eager and everything
 * below is one click away. See `SessionReadinessCell`.
 */
const EAGER_READINESS_ROWS = 8;

/**
 * Technician landing screen — the worklist, not a dashboard.
 *
 * The whole point is the *reason* column: every startable session shows whether it is Ready or
 * Blocked and, when blocked, which gates failed (consent, patch test, room, device, operator
 * skill, package balance) with the backend's own `detail` and `resolvedBy` text. Expanding a row
 * mounts the existing `SessionPreflightPanel`, which is the same component the session execution
 * page uses — including "Begin procedure" and the audited hard-stop override — so a technician can
 * clear and start a session without leaving this screen.
 *
 * No parallel readiness implementation: this screen only composes `SessionReadinessBadge`
 * (via `SessionReadinessCell`) and `SessionPreflightPanel`.
 */
export default function TechnicianWorklistPage() {
  const { t } = useTranslation();

  // The list endpoint takes a single `status`, so a "startable" worklist is two queries merged
  // client-side (cheaper and more honest than fetching everything and filtering).
  const scheduled = useSessions({ status: 'SCHEDULED', limit: 100 });
  const checkedIn = useSessions({ status: 'CHECKED_IN', limit: 100 });

  const isLoading = scheduled.isLoading || checkedIn.isLoading;
  const sessions = useMemo(() => {
    const merged = [...(checkedIn.data?.items || []), ...(scheduled.data?.items || [])];
    return merged
      .filter((s) => STARTABLE_STATUSES.includes(s.status))
      .sort((a, b) => {
        // Checked-in patients are physically waiting — they come first.
        if (a.status !== b.status) return a.status === 'CHECKED_IN' ? -1 : 1;
        return new Date(a.scheduledDate || 0) - new Date(b.scheduledDate || 0);
      });
  }, [scheduled.data, checkedIn.data]);

  const waiting = sessions.filter((s) => s.status === 'CHECKED_IN').length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('treatments.worklist.title', 'My worklist')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'treatments.worklist.subtitle',
              'Sessions you can start now — and exactly what is blocking the ones you cannot.'
            )}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={APP_ROUTES.TREATMENT_DASHBOARD}>
            {t('treatments.worklist.allTreatments', 'All treatments')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [t('treatments.worklist.stats.startable', 'Startable'), sessions.length],
          [t('treatments.worklist.stats.waiting', 'Checked in / waiting'), waiting],
          [
            t('treatments.worklist.stats.scheduled', 'Scheduled'),
            sessions.length - waiting,
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{isLoading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && !sessions.length && (
        <EmptyState
          icon={ShieldCheck}
          title={t('treatments.worklist.empty', 'Nothing to start right now.')}
          description={t(
            'treatments.worklist.emptyHint',
            'Sessions appear here once they are scheduled or the patient is checked in.'
          )}
        />
      )}

      <div className="space-y-2">
        {sessions.map((session, index) => (
          <WorklistRow key={session.id} session={session} index={index} />
        ))}
      </div>
    </section>
  );
}

function WorklistRow({ session, index }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const start = useStartSession(session.id);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Activity className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-medium">
              {session.sessionNumber} · #{session.sessionIndex} ·{' '}
              {session.patient?.fullName || t('treatments.worklist.patient', 'Patient')}
            </p>
            <p className="text-xs text-muted-foreground">
              {session.treatmentPlan?.planNumber} ·{' '}
              {session.scheduledDate
                ? new Date(session.scheduledDate).toLocaleString()
                : t('treatmentSessions.list.unscheduled', 'Unscheduled')}
            </p>
          </div>
          <Badge>{SESSION_STATUS_LABELS[session.status] || session.status}</Badge>
          {/* WHY a row is blocked — the gate labels come straight off the pre-flight response. */}
          <SessionReadinessCell
            session={session}
            index={index}
            eagerLimit={EAGER_READINESS_ROWS}
          />
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            <Chevron className="h-4 w-4" />
            {open
              ? t('treatments.worklist.hideChecks', 'Hide checks')
              : t('treatments.worklist.showChecks', 'Show checks')}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to={treatmentSessionPath(session.id)}>
              {t('treatments.worklist.open', 'Open session')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Full per-gate checklist + Begin procedure + audited override — the very same component
          the execution page renders, mounted only on expand so it never adds a request per row. */}
      {open && (
        <div className="border-t p-3">
          <PermissionGuard
            permissions={[PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL]}
            fallback={
              <p className="text-sm text-muted-foreground">
                {t(
                  'treatments.worklist.noStartPermission',
                  'You can view this session but not start it.'
                )}
              </p>
            }
          >
            <SessionPreflightPanel
              sessionId={session.id}
              session={session}
              isStarting={start.isPending}
              onStart={(extra = {}) => start.mutate({ ...extra })}
            />
          </PermissionGuard>
        </div>
      )}
    </div>
  );
}
