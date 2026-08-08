import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { useSessionPreflight } from '../hooks/useTreatmentSessions';
import { PREFLIGHT_GATE_LABELS } from '../constants';

/**
 * TRT-006 — lightweight queue-row readiness chip. Reuses the same pre-flight endpoint as the
 * execution page so a technician can see *why* a card is blocked before opening it. Only queried
 * for sessions that can actually be started.
 */
export function SessionReadinessBadge({ session }) {
  const { t } = useTranslation();
  const startable = ['SCHEDULED', 'CHECKED_IN'].includes(session?.status);
  const { data: preflight, isLoading } = useSessionPreflight(session?.id, startable);

  if (!startable) return null;
  if (isLoading || !preflight) {
    return (
      <Badge variant="outline">{t('treatmentSessions.readiness.checking', 'Checking…')}</Badge>
    );
  }

  if (preflight.canStart) {
    return <Badge variant="outline">{t('treatmentSessions.readiness.ready', 'Ready')}</Badge>;
  }

  const blockers = (preflight.gates || []).filter((g) => g.blocking && !g.passed);
  const reasons = blockers
    .map((g) => PREFLIGHT_GATE_LABELS[g.key] || g.label)
    .join(', ');

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant="destructive">{t('treatmentSessions.readiness.blocked', 'Blocked')}</Badge>
      <span className="text-xs text-destructive" title={blockers.map((g) => g.detail).filter(Boolean).join('\n')}>
        {reasons}
      </span>
    </span>
  );
}

export default SessionReadinessBadge;
