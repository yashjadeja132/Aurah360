import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';
import { NotificationInboxPanel } from '@/modules/notifications/components/NotificationInboxPanel';
import { NotificationTemplatesPanel } from '@/modules/notifications/components/NotificationTemplatesPanel';
import { NotificationDeliveryLogPanel } from '@/modules/notifications/components/NotificationDeliveryLogPanel';
import { ConsentCategoriesPanel } from '@/modules/notifications/components/ConsentCategoriesPanel';

/**
 * /notifications, /notifications/log and /notifications/templates were all
 * wrapped in the same `NotificationsPermission` (notifications.view /
 * notifications.*). Carrying those gates over verbatim gives one shared gate for
 * all three tabs — no permission-conditional tab entries, because there was no
 * per-page permission difference to preserve.
 */
const NOTIFICATION_PERMS = [PERMISSIONS.NOTIFICATIONS_VIEW, PERMISSIONS.NOTIFICATIONS_ALL];

export const COMMUNICATION_HUB_PERMISSIONS = NOTIFICATION_PERMS;

/**
 * Single Communication screen: NotificationCenterPage, TemplateManagerPage and
 * DeliveryLogPage as tabs. Tab lives in `?tab=` so a tab is deep-linkable, and
 * the log tab also reads `?channel=` / `?status=` so a failed-delivery
 * investigation can be linked to directly.
 */
export default function CommunicationHubPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const TABS = useMemo(
    () => [
      { id: 'inbox', label: t('notifications.hub.tabs.inbox', 'Inbox') },
      { id: 'templates', label: t('notifications.hub.tabs.templates', 'Templates') },
      { id: 'consent', label: t('notifications.hub.tabs.consent', 'Consent categories') },
      { id: 'log', label: t('notifications.hub.tabs.log', 'Delivery log') },
    ],
    [t]
  );

  const requested = searchParams.get('tab');
  const tab = TABS.some((tb) => tb.id === requested) ? requested : TABS[0]?.id;

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  return (
    <PermissionGuard permissions={COMMUNICATION_HUB_PERMISSIONS} fallback="redirect">
      <section className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('notifications.center.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'notifications.hub.subtitle',
              'Your inbox, message templates and outbound delivery log in one place'
            )}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-border pb-px">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={cn(
                'border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                tab === tb.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === 'inbox' && (
          <PermissionGuard permissions={NOTIFICATION_PERMS}>
            <NotificationInboxPanel />
          </PermissionGuard>
        )}
        {tab === 'templates' && (
          <PermissionGuard permissions={NOTIFICATION_PERMS}>
            <NotificationTemplatesPanel />
          </PermissionGuard>
        )}
        {tab === 'consent' && (
          <PermissionGuard permissions={[PERMISSIONS.CONSENT_VIEW, PERMISSIONS.CONSENT_ALL]}>
            <ConsentCategoriesPanel />
          </PermissionGuard>
        )}
        {tab === 'log' && (
          <PermissionGuard permissions={NOTIFICATION_PERMS}>
            <NotificationDeliveryLogPanel
              initialChannel={searchParams.get('channel') || ''}
              initialStatus={searchParams.get('status') || ''}
            />
          </PermissionGuard>
        )}
      </section>
    </PermissionGuard>
  );
}
