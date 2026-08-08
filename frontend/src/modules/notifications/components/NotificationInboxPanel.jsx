import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import {
  useInbox,
  useMarkRead,
  useMarkAllRead,
  useUnreadCount,
} from '@/modules/notifications/hooks/useNotifications';

/**
 * Body of the former NotificationCenterPage. The "Delivery log" / "Templates"
 * header links are gone — those are sibling tabs now. Existing i18n keys are
 * reused unchanged (they already exist in en.json, so `npm run i18n:check`
 * accepts them without a default); only genuinely new keys carry defaults.
 */
export function NotificationInboxPanel() {
  const { t } = useTranslation();
  const { data, isLoading } = useInbox({ limit: 50 });
  const { data: unread } = useUnreadCount();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t('notifications.center.subtitle', { count: unread ?? 0 })}
        </p>
        <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
          {t('notifications.center.markAllRead')}
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {items.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`w-full rounded-xl border p-3 text-left ${
              n.isRead ? 'bg-card' : 'border-primary/40 bg-primary/5'
            }`}
            onClick={() => !n.isRead && markRead.mutate(n.id)}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{n.subject || n.eventName}</p>
              <Badge variant="outline">{n.channel}</Badge>
              <Badge>{n.status}</Badge>
              {!n.isRead && <Badge>{t('notifications.center.unread')}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
            {/* Dropped the raw notificationId — the subject above already names this message. */}
            <p className="mt-1 text-xs text-muted-foreground">
              {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
            </p>
          </button>
        ))}
        {!items.length && !isLoading && (
          <EmptyState
            icon={Bell}
            title={t('notifications.center.noNotifications')}
            description={t(
              'notifications.hub.inbox.emptyHint',
              'In-app messages addressed to you land here.'
            )}
          />
        )}
      </div>
    </div>
  );
}

export default NotificationInboxPanel;
