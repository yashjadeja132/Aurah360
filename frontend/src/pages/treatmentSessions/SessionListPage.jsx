import { useTranslation } from 'react-i18next';
import { SessionQueuePanel } from '@/modules/treatmentSessions/components/SessionQueuePanel';

/**
 * Thin wrapper for the standalone `/treatments/sessions` route (still deep linked with
 * `?treatmentPlanId=` / `?invoiceId=` from billing and plan screens). The body lives in
 * `SessionQueuePanel` and is shared with the Treatments hub's Sessions tab.
 */
export default function SessionListPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">
        {t('treatmentSessions.list.title', 'Treatment Sessions')}
      </h1>
      <SessionQueuePanel />
    </section>
  );
}
