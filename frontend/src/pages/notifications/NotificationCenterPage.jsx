import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { NotificationInboxPanel } from '@/modules/notifications/components/NotificationInboxPanel';
import { APP_ROUTES } from '@/constants/routes';

/**
 * Thin wrapper — the body lives in `NotificationInboxPanel` and is shared with the Communication
 * hub's Inbox tab. The "Delivery log" / "Templates" links stay here because standalone there are no
 * sibling tabs to reach them through; "Mark all read" lives inside the panel.
 */
export default function NotificationCenterPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('notifications.center.title')}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.NOTIFICATION_LOG}>{t('notifications.center.deliveryLog')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.NOTIFICATION_TEMPLATES}>{t('notifications.center.templates')}</Link>
          </Button>
        </div>
      </div>
      <NotificationInboxPanel />
    </section>
  );
}
