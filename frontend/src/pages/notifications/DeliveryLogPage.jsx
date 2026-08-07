import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  useNotifications,
  useRetryNotification,
  useNotificationReports,
} from '@/modules/notifications/hooks/useNotifications';
import { notificationsApi } from '@/modules/notifications/api/notificationsApi';
import { toast } from 'sonner';

export default function DeliveryLogPage() {
  const { t } = useTranslation();
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
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
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('notifications.deliveryLog.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('notifications.deliveryLog.subtitle')}
          </p>
        </div>
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
          {['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP', 'PUSH'].map((c) => (
            <option key={c} value={c}>
              {t(`notifications.channels.${c}`)}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('notifications.deliveryLog.allStatuses')}</option>
          {['QUEUED', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED'].map((s) => (
            <option key={s} value={s}>
              {t(`notifications.statuses.${s}`)}
            </option>
          ))}
        </Select>
        <input
          className="h-10 rounded-md border px-3 text-sm"
          placeholder={t('notifications.deliveryLog.eventNamePlaceholder')}
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
        {items.map((n) => (
          <div
            key={n.id}
            className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {n.notificationId} · {n.eventName}
              </p>
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
      </div>
    </section>
  );
}
