import { useTranslation } from 'react-i18next';
import { NotificationTemplatesPanel } from '@/modules/notifications/components/NotificationTemplatesPanel';

/**
 * Thin wrapper — the body lives in `NotificationTemplatesPanel` and is shared with the
 * Communication hub's Templates tab.
 */
export default function TemplateManagerPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">
        {t('notifications.templates.title')}
      </h1>
      <NotificationTemplatesPanel />
    </section>
  );
}
