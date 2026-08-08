import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import {
  useNotifications,
  useRetryNotification,
  useNotificationReports,
} from '@/modules/notifications/hooks/useNotifications';
import { notificationsApi } from '@/modules/notifications/api/notificationsApi';

const CHANNELS = ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH'];
const STATUSES = ['QUEUED', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED'];

/**
 * Body of the former DeliveryLogPage. `initialChannel` / `initialStatus` let the
 * hub deep-link straight into "show me the failed SMS" — the investigation the
 * flow doc describes as requiring full sidebar re-navigation before.
 */
export function NotificationDeliveryLogPanel({ initialChannel = '', initialStatus = '' }) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState(initialChannel);
  const [status, setStatus] = useState(initialStatus);
  const [eventName, setEventName] = useState('');
  const { data, isLoading, refetch } = useNotifications({
    channel: channel || undefined,
    status: status || undefined,
    eventName: eventName || undefined,
    limit: 50,
  });
  const { data: reports } = useNotificationReports();
  const retry = useRetryNotification();
  const items = data?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{t('notifications.deliveryLog.subtitle')}</p>
        <Button
          variant="outline"
          onClick={async () => {
            await notificationsApi.processPending();
            toast.success(t('notifications.deliveryLog.processedToast'));
            refetch();
          }}
        >
          {t('notifications.deliveryLog.processPending')}
        </Button>
      </div>

      {reports && (
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            [t('notifications.deliveryLog.sent'), reports.deliverySuccess],
            [t('notifications.deliveryLog.failed'), reports.failedMessages],
            [t('notifications.deliveryLog.successRate'), reports.successRate],
            [t('notifications.deliveryLog.total'), reports.total],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold">{value ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">{t('notifications.deliveryLog.allChannels')}</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {t(`notifications.channels.${c}`)}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('notifications.deliveryLog.allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`notifications.statuses.${s}`)}
            </option>
          ))}
        </Select>
        <Input
          placeholder={t('notifications.deliveryLog.eventNamePlaceholder')}
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {items.map((n) => (
          <div
            key={n.id}
            className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              {/* The raw notificationId used to lead this line; it identified nothing a human
                  could act on. Event name + recipient + timestamp do that job. */}
              <p className="font-medium">{n.eventName}</p>
              <p className="text-xs text-muted-foreground">
                {n.recipient} · {n.message?.slice(0, 80)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{n.channel}</Badge>
              <Badge>{n.status}</Badge>
              {n.status === 'FAILED' && (
                <Button size="sm" variant="outline" onClick={() => retry.mutate(n.id)}>
                  {t('common.retry')}
                </Button>
              )}
            </div>
          </div>
        ))}
        {!items.length && !isLoading && (
          <EmptyState
            icon={Send}
            title={t('notifications.hub.log.empty', 'No delivery records.')}
            description={t(
              'notifications.hub.log.emptyHint',
              'Nothing matches these filters — clear them to see all outbound messages.'
            )}
          />
        )}
      </div>
    </div>
  );
}

export default NotificationDeliveryLogPanel;
