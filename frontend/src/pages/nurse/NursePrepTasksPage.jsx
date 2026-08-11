import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useSessions } from '@/modules/treatmentSessions/hooks/useTreatmentSessions';
import { SessionPreflightPanel } from '@/modules/treatmentSessions/components/SessionPreflightPanel';
import { SESSION_STATUS_LABELS } from '@/modules/treatmentSessions/constants';

/**
 * Nurse-facing "Tasks" — same-day treatment prep checklist (role-flow audit fix).
 *
 * Lists treatment sessions awaiting prep at the nurse's own branch (branch scope is enforced
 * server-side from the caller's token, same as TechnicianWorklistPage — a nurse cannot widen it
 * by querying a different branchId). "Awaiting prep" is the same statusOk window
 * TreatmentSessionService#getPreflight uses (SCHEDULED / CHECKED_IN) — i.e. every session a
 * technician could conceivably start, which is exactly the set a nurse needs to have prepped.
 *
 * Opening a task mounts the EXACT SAME `SessionPreflightPanel` the technician worklist and the
 * session execution screen use — the six-gate checklist (consent, photos, patch test,
 * contraindication screening, room/device readiness, consumables staged) is not re-implemented
 * here. `showActions={false}` hides "Begin procedure" and the hard-stop override: those call
 * POST /treatment-sessions/:id/start, a Technician/supervisor act the nurse does not hold
 * (treatment_session.complete / treatment.hard_stop_override). The nurse's job is to clear the
 * gates — editing the session via PATCH /:id (contraindication screening, consumables, device
 * readiness) — the panel already exposes everything read-only; write flows for these fields
 * live on the session execution page/forms, which nurses can now reach because they hold
 * treatment_session.edit (see rolePermissions.js NURSE grant).
 *
 * There is deliberately no separate "Mark ready" endpoint to call: this codebase has no
 * dedicated READY status distinct from SCHEDULED/CHECKED_IN — a session already reads as
 * "Ready" in the technician worklist (`SessionReadinessCell`) the moment
 * `getPreflight().canStart` is true, which is exactly what filling in the checklist fields
 * below drives to true. "Mark ready" IS "clear every gate"; there is nothing further to submit.
 */
const PREP_STATUSES = ['SCHEDULED', 'CHECKED_IN'];

export default function NursePrepTasksPage() {
  const { t } = useTranslation();

  const scheduled = useSessions({ status: 'SCHEDULED', limit: 100 });
  const checkedIn = useSessions({ status: 'CHECKED_IN', limit: 100 });

  const isLoading = scheduled.isLoading || checkedIn.isLoading;
  const sessions = useMemo(() => {
    const merged = [...(checkedIn.data?.items || []), ...(scheduled.data?.items || [])];
    return merged
      .filter((s) => PREP_STATUSES.includes(s.status))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'CHECKED_IN' ? -1 : 1;
        return new Date(a.scheduledDate || 0) - new Date(b.scheduledDate || 0);
      });
  }, [scheduled.data, checkedIn.data]);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('nurse.tasks.title', 'Tasks')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'nurse.tasks.subtitle',
            'Treatment prep for same-day sessions — clear every checklist item before the technician begins the procedure.'
          )}
        </p>
      </div>

      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && !sessions.length && (
        <EmptyState
          icon={ClipboardCheck}
          title={t('nurse.tasks.empty', 'No prep tasks right now.')}
          description={t(
            'nurse.tasks.emptyHint',
            'Same-day treatment sessions appear here once they are scheduled or the patient is checked in.'
          )}
        />
      )}

      <div className="space-y-2">
        {sessions.map((session) => (
          <PrepTaskRow key={session.id} session={session} />
        ))}
      </div>
    </section>
  );
}

function PrepTaskRow({ session }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <ClipboardCheck className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="font-medium">
              {session.sessionNumber} · #{session.sessionIndex} ·{' '}
              {session.patient?.fullName || t('nurse.tasks.patient', 'Patient')}
            </p>
            <p className="text-xs text-muted-foreground">
              {session.treatmentPlan?.planNumber} ·{' '}
              {session.scheduledDate
                ? new Date(session.scheduledDate).toLocaleString()
                : t('treatmentSessions.list.unscheduled', 'Unscheduled')}
            </p>
          </div>
          <Badge>{SESSION_STATUS_LABELS[session.status] || session.status}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
          <Chevron className="h-4 w-4" />
          {open
            ? t('nurse.tasks.hideChecklist', 'Hide checklist')
            : t('nurse.tasks.openChecklist', 'Open checklist')}
        </Button>
      </div>

      {open && (
        <div className="border-t p-3">
          <SessionPreflightPanel sessionId={session.id} session={session} showActions={false} />
        </div>
      )}
    </div>
  );
}
