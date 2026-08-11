import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { CONSULTATION_STATUS_LABELS } from '../constants';

export function ConsultationStatusBadge({ status }) {
  const { t } = useTranslation();
  const variant =
    status === 'LOCKED'
      ? 'destructive'
      : status === 'SIGNED'
        ? 'success'
        : status === 'IN_PROGRESS'
          ? 'warning'
          : 'outline';
  return (
    <Badge variant={variant} className="px-2.5 py-1 text-xs font-semibold uppercase">
      {t(`consultations.statusLabels.${status}`, CONSULTATION_STATUS_LABELS[status] || status)}
    </Badge>
  );
}

export function DraftIndicator({ status }) {
  const { t } = useTranslation();
  if (status === 'saving') {
    return <span className="text-xs text-amber-700">{t('consultations.soap.draftSaving', 'Saving draft…')}</span>;
  }
  if (status === 'saved') {
    return <span className="text-xs text-emerald-700">{t('consultations.soap.draftSaved', 'Draft saved')}</span>;
  }
  if (status === 'error') {
    return <span className="text-xs text-destructive">{t('consultations.soap.draftFailed', 'Autosave failed')}</span>;
  }
  if (status === 'conflict') {
    return (
      <span className="text-xs font-semibold text-destructive">
        {t('consultations.soap.draftConflict', 'Save conflict')}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{t('consultations.soap.draftReady', 'Ready')}</span>;
}

/**
 * Fix 3 — optimistic-concurrency banner. Shown when the server rejects an autosave with 409
 * SOAP_VERSION_CONFLICT (someone else's save landed on this note in between). Deliberately no
 * auto-merge/auto-overwrite: the only actions offered are "keep editing this draft" (do nothing,
 * the doctor's unsaved text stays on screen and is not lost) or an explicit reload to see the
 * latest version.
 */
export function ConflictBanner({ onReload }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <span>
        {t(
          'consultations.soap.conflictBanner',
          'This note was changed elsewhere — reload to see the latest version. Your unsaved changes here are not saved until you reload and re-apply them.'
        )}
      </span>
      <button
        type="button"
        onClick={onReload}
        className="shrink-0 rounded-md border border-destructive/60 px-2 py-1 text-xs font-semibold hover:bg-destructive/10"
      >
        {t('consultations.soap.conflictReload', 'Reload')}
      </button>
    </div>
  );
}
