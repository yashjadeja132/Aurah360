import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NotificationDeliveryLogPanel } from '@/modules/notifications/components/NotificationDeliveryLogPanel';

/**
 * Thin wrapper — the body lives in `NotificationDeliveryLogPanel` and is shared with the
 * Communication hub's Delivery log tab. `?channel=` / `?status=` are passed through so a
 * failed-delivery investigation can be linked to on this route too, as it can in the hub.
 */
export default function DeliveryLogPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">
        {t('notifications.deliveryLog.title')}
      </h1>
      <NotificationDeliveryLogPanel
        initialChannel={params.get('channel') || ''}
        initialStatus={params.get('status') || ''}
      />
    </section>
  );
}
