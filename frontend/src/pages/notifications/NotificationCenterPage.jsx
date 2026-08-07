import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useInbox,
  useMarkRead,
  useMarkAllRead,
  useUnreadCount,
} from '@/modules/notifications/hooks/useNotifications';
import { APP_ROUTES } from '@/constants/routes';

export default function NotificationCenterPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useInbox({ limit: 50 });
  const { data: unread } = useUnreadCount();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const items = data?.items || [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('notifications.center.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('notifications.center.subtitle', { count: unread ?? 0 })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            {t('notifications.center.markAllRead')}
          </Button>
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.NOTIFICATION_LOG}>{t('notifications.center.deliveryLog')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.NOTIFICATION_TEMPLATES}>{t('notifications.center.templates')}</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
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
            <p className="mt-1 text-xs text-muted-foreground">
              {n.notificationId} · {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
            </p>
          </button>
        ))}
        {!items.length && !isLoading && (
          <p className="text-sm text-muted-foreground">{t('notifications.center.noNotifications')}</p>
        )}
      </div>
    </section>
  );
}
