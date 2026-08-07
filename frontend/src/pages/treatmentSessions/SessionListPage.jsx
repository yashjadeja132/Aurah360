import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import {
  useSessions,
  useCreateSession,
} from '@/modules/treatmentSessions/hooks/useTreatmentSessions';
import { SESSION_STATUS_LABELS } from '@/modules/treatmentSessions/constants';
import { treatmentSessionPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

export default function SessionListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planFromQuery = searchParams.get('treatmentPlanId') || '';
  const invoiceFromQuery = searchParams.get('invoiceId') || '';

  const [status, setStatus] = useState('');
  const [planId, setPlanId] = useState(planFromQuery);
  const [invoiceId, setInvoiceId] = useState(invoiceFromQuery);

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
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('treatmentSessions.list.title', 'Treatment Sessions')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'treatmentSessions.list.subtitle',
            'Requires accepted plan + paid/partial invoice. Session limit enforced.'
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder={t('treatmentSessions.list.treatmentPlanIdPlaceholder', 'Treatment plan ID')}
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
        />
        <Input
          placeholder={t('treatmentSessions.list.invoiceIdPlaceholder', 'Invoice ID')}
          value={invoiceId}
          onChange={(e) => setInvoiceId(e.target.value)}
        />
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
        {isLoading && (
          <p className="text-sm text-muted-foreground">{t('treatmentSessions.list.loading', 'Loading…')}</p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
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
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to={treatmentSessionPath(s.id)}>{t('treatmentSessions.list.open', 'Open')}</Link>
            </Button>
          </div>
        ))}
        {!sessions.length && !isLoading && (
          <p className="text-sm text-muted-foreground">
            {t('treatmentSessions.list.emptyState', 'No sessions found.')}
          </p>
        )}
      </div>
    </section>
  );
}
