import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, MinusCircle, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useSessionPreflight } from '../hooks/useTreatmentSessions';
import { PREFLIGHT_GATE_LABELS } from '../constants';

/**
 * TRT-006 — pre-flight safety checklist for "Begin procedure".
 * Renders the backend's per-gate result (GET /treatment-sessions/:id/preflight — the very same
 * evaluators start() enforces), so the technician sees item-by-item pass/fail with the failure
 * reason and who resolves it, instead of discovering a hard stop via a generic error toast.
 * "Begin procedure" stays disabled until every blocking gate passes; users holding
 * treatment.hard_stop_override additionally get an override-with-reason affordance.
 */
export function SessionPreflightPanel({ sessionId, session, onStart, isStarting }) {
  const { t } = useTranslation();
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverride, setShowOverride] = useState(false);

  const startable = ['SCHEDULED', 'CHECKED_IN'].includes(session?.status);
  const { data: preflight, isLoading, isError, error } = useSessionPreflight(sessionId, startable);

  if (!startable) return null;

  if (isLoading) {
    return (
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        {t('treatmentSessions.preflight.loading', 'Running pre-flight safety checks…')}
      </div>
    );
  }
  if (isError || !preflight) {
    return (
      <div className="rounded-xl border p-4 text-sm text-destructive">
        {error?.response?.data?.message ||
          t('treatmentSessions.preflight.failed', 'Could not run pre-flight safety checks')}
      </div>
    );
  }

  const gates = preflight.gates || [];
  const blockers = gates.filter((g) => g.blocking && !g.passed);

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">
          {t('treatmentSessions.preflight.title', 'Pre-flight safety checks')}
        </h2>
        {preflight.canStart ? (
          <Badge>{t('treatmentSessions.preflight.ready', 'Ready to begin')}</Badge>
        ) : (
          <Badge variant="destructive">
            {t('treatmentSessions.preflight.blockedCount', 'Blocked')} · {blockers.length}
          </Badge>
        )}
      </div>

      <ul className="space-y-2">
        {gates.map((gate) => {
          const skipped = !gate.applicable || !gate.evaluated;
          const Icon = gate.passed ? CheckCircle2 : skipped ? MinusCircle : XCircle;
          const tone = gate.passed
            ? 'text-success'
            : skipped
              ? 'text-muted-foreground'
              : 'text-destructive';
          return (
            <li key={gate.key} className="flex items-start gap-3 border-b border-dashed pb-2 text-sm last:border-0">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {t(`treatmentSessions.preflight.gates.${gate.key}`, PREFLIGHT_GATE_LABELS[gate.key] || gate.label)}
                  {!gate.blocking && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {t('treatmentSessions.preflight.advisory', 'advisory')}
                    </span>
                  )}
                </p>
                {gate.detail && (
                  <p className={gate.passed ? 'text-xs text-muted-foreground' : `text-xs ${tone}`}>
                    {gate.detail}
                  </p>
                )}
                {!gate.passed && gate.blocking && gate.resolvedBy && (
                  <p className="text-xs text-muted-foreground">
                    {t('treatmentSessions.preflight.resolvedBy', 'Resolved by')}: {gate.resolvedBy}
                  </p>
                )}
                {!gate.applicable && !gate.detail && (
                  <p className="text-xs text-muted-foreground">
                    {t('treatmentSessions.preflight.notApplicable', 'Not applicable to this session')}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!preflight.canStart || isStarting}
          onClick={() => onStart()}
        >
          {t('treatmentSessions.preflight.begin', 'Begin procedure')}
        </Button>
        {!preflight.canStart && (
          <p className="text-xs text-muted-foreground">
            {t(
              'treatmentSessions.preflight.blockedHint',
              'Clear every blocking check above before the procedure can begin.'
            )}
          </p>
        )}
      </div>

      {/* Audited hard-stop override — only for holders of treatment.hard_stop_override.
          canOverride comes from the server (it evaluates the same permission start() checks). */}
      {!preflight.canStart && preflight.canOverride && preflight.requiresOverride && (
        <div className="space-y-2 rounded-lg border border-dashed border-destructive/50 p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-destructive">
            <ShieldAlert className="h-4 w-4" />
            {t('treatmentSessions.preflight.overrideTitle', 'Override hard stop (audited)')}
          </div>
          {!showOverride ? (
            <Button variant="outline" size="sm" onClick={() => setShowOverride(true)}>
              {t('treatmentSessions.preflight.overrideOpen', 'Override with reason')}
            </Button>
          ) : (
            <>
              <div>
                <Label>{t('treatmentSessions.preflight.overrideReason', 'Reason (required)')}</Label>
                <Input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder={t(
                    'treatmentSessions.preflight.overrideReasonPlaceholder',
                    'Why is it clinically safe to proceed?'
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  'treatmentSessions.preflight.overrideNotice',
                  'This override is recorded on the session and written to the audit log.'
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!overrideReason.trim() || isStarting}
                  onClick={() => onStart({ override: { reason: overrideReason.trim() } })}
                >
                  {t('treatmentSessions.preflight.overrideConfirm', 'Begin with override')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowOverride(false)}>
                  {t('treatmentSessions.preflight.overrideCancel', 'Cancel')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {!preflight.canStart && !preflight.canOverride && preflight.requiresOverride && (
        <p className="text-xs text-muted-foreground">
          {t(
            'treatmentSessions.preflight.overrideNoPermission',
            'These stops can only be overridden by a supervisor with override permission.'
          )}
        </p>
      )}
    </div>
  );
}

export default SessionPreflightPanel;
