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
  return <span className="text-xs text-muted-foreground">{t('consultations.soap.draftReady', 'Ready')}</span>;
}
