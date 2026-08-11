import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useSessions, useCreateSession, useSessionDashboard } from '../hooks/useTreatmentSessions';
import { useTreatmentPlan } from '@/modules/treatmentPlans/hooks/useTreatmentPlans';
import { useInvoice } from '@/modules/billing/hooks/useBilling';
import { SessionReadinessCell } from './SessionReadinessCell';
import { SESSION_STATUS_LABELS } from '../constants';
import { treatmentSessionPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

/**
 * Sessions tab of the Treatments hub. Merges what used to be two separate top-level routes —
 * `TreatmentDashboardPage` (the counts strip) and `SessionListPage` (the filterable queue) —
 * into one panel, because the counts were only ever a header for the same list.
 *
 * Session EXECUTION stays its own route: it is a workflow record, not a tab.
 */
export function SessionQueuePanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState('');
  const planFromQuery = searchParams.get('treatmentPlanId') || '';
  const invoiceFromQuery = searchParams.get('invoiceId') || '';
  const [planId, setPlanId] = useState(planFromQuery);
  const [invoiceId, setInvoiceId] = useState(invoiceFromQuery);
  // Deep-linked from a plan/invoice — resolve to human-readable labels so the raw ObjectId
  // never has to be shown as visible text; only queried when the id actually came from the URL.
  const { data: linkedPlan } = useTreatmentPlan(planFromQuery || undefined);
  const { data: linkedInvoice } = useInvoice(invoiceFromQuery || undefined);

  const { data: dashboard, isLoading: summaryLoading } = useSessionDashboard();
  const summary = dashboard?.summary || {};

  const { data, isLoading } = useSessions({
    treatmentPlanId: planId || undefined,
    status: status || undefined,
    limit: 50,
  });
  const sessions = data?.items || [];
  const create = useCreateSession();

  const startSession = async () => {
    if (!planId || !invoiceId) return;
    const res = await create.mutateAsync({
      treatmentPlanId: planId,
      invoiceId,
      scheduledDate: new Date().toISOString(),
    });
    const id = res?.data?.session?.id;
    if (id) navigate(treatmentSessionPath(id));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [t('treatmentSessions.dashboard.scheduled', 'Scheduled'), summary.scheduled],
          [t('treatmentSessions.dashboard.inProgress', 'In progress'), summary.inProgress],
          [
            t('treatmentSessions.dashboard.completedToday', 'Completed today'),
            summary.completedToday,
          ],
          [t('treatmentSessions.dashboard.total', 'Total'), summary.total],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{summaryLoading ? '—' : value ?? 0}</p>
          </div>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {t(
          'treatmentSessions.list.subtitle',
          'Requires accepted plan + paid/partial invoice. Session limit enforced.'
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {planFromQuery ? (
          <div className="flex items-center rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="font-medium">
              {linkedPlan?.planNumber || t('common.loading', 'Loading…')}
            </span>
            {linkedPlan?.patient?.fullName && (
              <span className="ml-1 text-muted-foreground">· {linkedPlan.patient.fullName}</span>
            )}
          </div>
        ) : (
          <Input
            placeholder={t('treatmentSessions.list.treatmentPlanIdPlaceholder', 'Treatment plan ID')}
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
          />
        )}
        {invoiceFromQuery ? (
          <div className="flex items-center rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="font-medium">
              {linkedInvoice?.invoiceNumber || t('common.loading', 'Loading…')}
            </span>
          </div>
        ) : (
          <Input
            placeholder={t('treatmentSessions.list.invoiceIdPlaceholder', 'Invoice ID')}
            value={invoiceId}
            onChange={(e) => setInvoiceId(e.target.value)}
          />
        )}
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('treatmentSessions.list.allStatuses', 'All statuses')}</option>
          {Object.entries(SESSION_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <PermissionGuard
          permissions={[PERMISSIONS.TREATMENT_SESSION_CREATE, PERMISSIONS.TREATMENT_SESSION_ALL]}
        >
          <Button onClick={startSession} disabled={!planId || !invoiceId || create.isPending}>
            <Plus className="h-4 w-4" />
            {t('treatmentSessions.list.newSession', 'New session')}
          </Button>
        </PermissionGuard>
      </div>

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {sessions.map((s, i) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Activity className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">
                  {s.sessionNumber} · #{s.sessionIndex} · {s.patient?.fullName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.treatmentPlan?.planNumber} ·{' '}
                  {s.scheduledDate
                    ? new Date(s.scheduledDate).toLocaleString()
                    : t('treatmentSessions.list.unscheduled', 'Unscheduled')}
                </p>
              </div>
              <Badge>{SESSION_STATUS_LABELS[s.status]}</Badge>
              {/* TRT-006 — pre-communicate why a queued session is blocked */}
              <SessionReadinessCell session={s} index={i} />
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to={treatmentSessionPath(s.id)}>{t('treatmentSessions.list.open', 'Open')}</Link>
            </Button>
          </div>
        ))}
        {!sessions.length && !isLoading && (
          <EmptyState
            icon={Activity}
            title={t('treatmentSessions.list.emptyState', 'No sessions found.')}
            description={t(
              'treatmentSessions.list.emptyHint',
              'Sessions appear once a plan is accepted and its invoice is paid or partially paid.'
            )}
          />
        )}
      </div>
    </div>
  );
}

export default SessionQueuePanel;
