import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import {
  useSession,
  useCheckInSession,
  useStartSession,
  useCompleteSession,
  useCancelSession,
  useSkipSession,
  useRescheduleSession,
  useUploadSessionPhoto,
} from '@/modules/treatmentSessions/hooks/useTreatmentSessions';
import { SESSION_STATUS_LABELS } from '@/modules/treatmentSessions/constants';
import { APP_ROUTES, treatmentSessionPrintPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { APP_CONFIG } from '@/constants/config';

export default function SessionExecutionPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: session, isLoading, isError, error } = useSession(id);
  const checkIn = useCheckInSession(id);
  const start = useStartSession(id);
  const complete = useCompleteSession(id);
  const cancel = useCancelSession(id);
  const skip = useSkipSession(id);
  const reschedule = useRescheduleSession(id);
  const upload = useUploadSessionPhoto(id);

  const [outcome, setOutcome] = useState('');
  const [device, setDevice] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');

  if (isLoading)
    return (
      <p className="p-6 text-sm text-muted-foreground">{t('treatmentSessions.execution.loading', 'Loading…')}</p>
    );
  if (isError || !session) {
    return (
      <p className="p-6 text-sm text-destructive">
        {error?.response?.data?.message || t('treatmentSessions.execution.notFound', 'Session not found')}
      </p>
    );
  }

  const progress = session.progress || {};
  const pct = progress.completionPercent || 0;

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to={APP_ROUTES.TREATMENT_SESSIONS}>
              <ArrowLeft className="h-4 w-4" />
              {t('treatmentSessions.execution.back', 'Back')}
            </Link>
          </Button>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-primary">
              {session.sessionNumber}
            </h1>
            <Badge>{SESSION_STATUS_LABELS[session.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {session.patient?.fullName} · {t('treatmentSessions.execution.doctorPrefix', 'Dr.')}{' '}
            {session.doctor?.name || '—'} · {t('treatmentSessions.execution.techPrefix', 'Tech')}{' '}
            {session.technician?.fullName || '—'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={treatmentSessionPrintPath(id)}>
            <Printer className="h-4 w-4" />
            {t('treatmentSessions.execution.print', 'Print')}
          </Link>
        </Button>
      </div>

      {/* Large progress bar */}
      <div className="rounded-xl border p-4">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium">{t('treatmentSessions.execution.planProgress', 'Plan progress')}</span>
          <span>
            {progress.completedSessions ?? 0}/{progress.totalSessions ?? '—'} · {pct}%
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t('treatmentSessions.execution.remaining', 'Remaining')} {progress.remainingSessions ?? '—'} ·{' '}
          {t('treatmentSessions.execution.expectedEnd', 'Expected end')}{' '}
          {progress.expectedEndDate
            ? new Date(progress.expectedEndDate).toLocaleDateString()
            : '—'}
        </p>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">{t('treatmentSessions.execution.progressTimeline', 'Progress timeline')}</h2>
        <div className="space-y-2">
          {(progress.sessions || []).map((s) => (
            <div key={s.id} className="flex items-center gap-3 text-sm">
              <span className="w-16 text-muted-foreground">#{s.sessionIndex}</span>
              <Badge variant="outline">{SESSION_STATUS_LABELS[s.status]}</Badge>
              <span>{s.sessionNumber}</span>
              <span className="text-muted-foreground">
                {s.completedAt
                  ? new Date(s.completedAt).toLocaleDateString()
                  : s.scheduledDate
                    ? new Date(s.scheduledDate).toLocaleDateString()
                    : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Technician workflow actions */}
      <div className="flex flex-wrap gap-2 rounded-xl border p-4">
        <PermissionGuard
          permissions={[PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL]}
        >
          {session.status === 'SCHEDULED' && (
            <Button variant="outline" disabled={checkIn.isPending} onClick={() => checkIn.mutate()}>
              {t('treatmentSessions.execution.checkIn', 'Check in')}
            </Button>
          )}
          {['SCHEDULED', 'CHECKED_IN'].includes(session.status) && (
            <Button
              disabled={start.isPending}
              onClick={() =>
                start.mutate({
                  deviceUsage: { device: device || session.deviceId, machine: 'Unit 1' },
                })
              }
            >
              {t('treatmentSessions.execution.startSession', 'Start session')}
            </Button>
          )}
        </PermissionGuard>
        <PermissionGuard
          permissions={[
            PERMISSIONS.TREATMENT_SESSION_COMPLETE,
            PERMISSIONS.TREATMENT_SESSION_ALL,
          ]}
        >
          {session.status === 'IN_PROGRESS' && (
            <Button
              disabled={complete.isPending}
              onClick={() =>
                complete.mutate({
                  outcome: outcome || t('treatmentSessions.execution.completedSuccessfully', 'Completed successfully'),
                  deviceUsage: {
                    device: device || session.deviceUsage?.device,
                    machine: session.deviceUsage?.machine,
                    laserHead: session.deviceUsage?.laserHead,
                    settings: session.deviceUsage?.settings || {},
                  },
                  followUp: nextDate
                    ? { nextSessionDate: nextDate, notes: t('treatmentSessions.execution.nextAsPlanned', 'Next as planned') }
                    : undefined,
                })
              }
            >
              {t('treatmentSessions.execution.complete', 'Complete')}
            </Button>
          )}
        </PermissionGuard>
        <PermissionGuard
          permissions={[PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL]}
        >
          {['SCHEDULED', 'CHECKED_IN'].includes(session.status) && (
            <Button variant="outline" disabled={skip.isPending} onClick={() => skip.mutate()}>
              {t('treatmentSessions.execution.skip', 'Skip')}
            </Button>
          )}
          {!['COMPLETED', 'CANCELLED'].includes(session.status) && (
            <Button variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              {t('treatmentSessions.execution.cancel', 'Cancel')}
            </Button>
          )}
        </PermissionGuard>
      </div>

      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
        <div>
          <Label>{t('treatmentSessions.execution.devicePlaceholderLabel', 'Device (placeholder)')}</Label>
          <Input
            value={device}
            placeholder={session.deviceUsage?.device || t('treatmentSessions.execution.device', 'Device')}
            onChange={(e) => setDevice(e.target.value)}
          />
        </div>
        <div>
          <Label>{t('treatmentSessions.execution.outcome', 'Outcome')}</Label>
          <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        </div>
        <div>
          <Label>{t('treatmentSessions.execution.nextSessionDate', 'Next session date')}</Label>
          <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label>{t('treatmentSessions.execution.reschedule', 'Reschedule')}</Label>
            <Input
              type="datetime-local"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
            />
          </div>
          <PermissionGuard
            permissions={[PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL]}
          >
            <Button
              variant="outline"
              disabled={!rescheduleDate || reschedule.isPending}
              onClick={() => reschedule.mutate(new Date(rescheduleDate).toISOString())}
            >
              {t('treatmentSessions.execution.save', 'Save')}
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Photo comparison */}
      <div className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">{t('treatmentSessions.execution.beforeAfter', 'Before / After')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">{t('treatmentSessions.execution.before', 'Before')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(session.photosBefore || []).map((p) => (
                <img
                  key={p.id || p.storageKey}
                  src={`${APP_CONFIG.apiOrigin}${p.url}`}
                  alt={p.title || t('treatmentSessions.execution.before', 'Before')}
                  className="h-28 w-full rounded-lg object-cover border"
                />
              ))}
            </div>
            <PermissionGuard
              permissions={[PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL]}
            >
              <Input
                className="mt-2"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate({ file, photoType: 'BEFORE' });
                }}
              />
            </PermissionGuard>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t('treatmentSessions.execution.after', 'After')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(session.photosAfter || []).map((p) => (
                <img
                  key={p.id || p.storageKey}
                  src={`${APP_CONFIG.apiOrigin}${p.url}`}
                  alt={p.title || t('treatmentSessions.execution.after', 'After')}
                  className="h-28 w-full rounded-lg object-cover border"
                />
              ))}
            </div>
            <PermissionGuard
              permissions={[PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL]}
            >
              <Input
                className="mt-2"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate({ file, photoType: 'AFTER' });
                }}
              />
            </PermissionGuard>
          </div>
        </div>
      </div>

      {/* Session log */}
      <div className="space-y-2 rounded-xl border p-4">
        <h2 className="font-semibold">{t('treatmentSessions.execution.sessionLog', 'Session log')}</h2>
        {(session.logs || []).map((l) => (
          <div key={l.id} className="border-b border-dashed py-2 text-sm">
            <p>
              {l.startTime ? new Date(l.startTime).toLocaleString() : '—'}
              {l.endTime ? ` → ${new Date(l.endTime).toLocaleString()}` : ''}
            </p>
            <p className="text-muted-foreground">
              {l.operatorName || t('treatmentSessions.execution.operator', 'Operator')} · {l.deviceUsed || '—'} ·{' '}
              {l.outcome || l.notes || ''}
            </p>
          </div>
        ))}
        {!session.logs?.length && (
          <p className="text-sm text-muted-foreground">
            {t('treatmentSessions.execution.noLogEntries', 'No log entries yet.')}
          </p>
        )}
      </div>

      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        {t('treatmentSessions.execution.invoice', 'Invoice')} {session.invoice?.invoiceNumber || session.invoiceId} ·{' '}
        {session.invoice?.paymentStatus || '—'} · {t('treatmentSessions.execution.plan', 'Plan')}{' '}
        {session.treatmentPlan?.planNumber} (
        {t('treatmentSessions.execution.notModifiedByExecution', 'not modified by execution')})
      </div>
    </section>
  );
}
