import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { usePatientNotifications } from '@/modules/patientPortal/hooks/usePatientPortal';
import { patientPortalApi } from '@/modules/patientPortal/api/patientApi';
import { useQueryClient } from '@tanstack/react-query';

export default function PatientNotificationsPage() {
  const { t } = useTranslation();
  const { data = [], isLoading } = usePatientNotifications();
  const qc = useQueryClient();
  const items = Array.isArray(data) ? data : [];

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-950">{t('portal.notifications.title', 'Notifications')}</h1>
        <p className="text-sm text-muted-foreground">{t('portal.notifications.subtitle', 'Your in-app inbox.')}</p>
      </div>
      <div className="space-y-2">
        {items.map((n) => (
          <div key={n.id} className="rounded-xl border bg-white/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{n.subject || n.eventName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
              </div>
              {!n.isRead && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await patientPortalApi.markRead(n.id);
                    toast.success(t('portal.notifications.markedRead', 'Marked read'));
                    qc.invalidateQueries({ queryKey: ['patient-portal'] });
                  }}
                >
                  {t('portal.notifications.markRead', 'Mark read')}
                </Button>
              )}
            </div>
          </div>
        ))}
        {!items.length && !isLoading && (
          <p className="text-sm text-muted-foreground">{t('portal.notifications.empty', 'No notifications.')}</p>
        )}
      </div>
    </section>
  );
}
