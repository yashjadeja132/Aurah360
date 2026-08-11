import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useConsentDefinitions } from '@/modules/notifications/hooks/useNotifications';

/**
 * Communications → Consent categories. Read-only view of the published consent
 * purposes/definitions (GET /consent/definitions) — the categories patients are
 * asked to grant/withdraw (marketing messages, photography, etc). Publishing a
 * new version stays on the backend `consent.manage` flow; this tab surfaces the
 * category list that was previously only reachable per-patient from Reception.
 */
export function ConsentCategoriesPanel() {
  const { t } = useTranslation();
  const { data: definitions = [], isLoading } = useConsentDefinitions();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          'notifications.hub.consent.subtitle',
          'Consent categories patients grant or withdraw. Marketing messages are suppressed automatically when consent is withdrawn; service/transactional messages never depend on it.'
        )}
      </p>

      {isLoading && <Skeleton className="h-24 w-full" />}

      {!isLoading && definitions.length === 0 && (
        <EmptyState
          icon={ShieldCheck}
          title={t('notifications.hub.consent.empty', 'No consent categories published yet.')}
        />
      )}

      <div className="space-y-2">
        {definitions.map((d) => (
          <div key={d.id || `${d.purpose}-${d.version}`} className="flex items-center justify-between gap-3 rounded-xl border p-4">
            <div>
              <p className="font-medium">{d.title || d.purpose}</p>
              <p className="text-xs text-muted-foreground">
                {t('notifications.hub.consent.purpose', 'Purpose')}: {d.purpose} · {t('notifications.hub.consent.version', 'Version')} {d.version}
                {d.effectiveFrom ? ` · ${t('notifications.hub.consent.effectiveFrom', 'Effective from')} ${new Date(d.effectiveFrom).toLocaleDateString()}` : ''}
              </p>
            </div>
            <Badge variant={d.isActive ? 'success' : 'secondary'}>
              {d.isActive ? t('notifications.hub.consent.active', 'Active') : t('notifications.hub.consent.inactive', 'Inactive')}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ConsentCategoriesPanel;
