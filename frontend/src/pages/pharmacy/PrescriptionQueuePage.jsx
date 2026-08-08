import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PrescriptionQueuePanel } from '@/modules/pharmacy/components/PrescriptionQueuePanel';

/**
 * Thin wrapper — the body lives in `PrescriptionQueuePanel` and is shared with the Pharmacy hub's
 * Prescription queue tab. This route owns its own query string, so `?rx=` is read here and passed
 * as the panel's `highlight`, keeping the deep link from the overview working.
 */
export default function PrescriptionQueuePage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">
        {t('pharmacy.queue.title', 'Prescription Queue')}
      </h1>
      <PrescriptionQueuePanel highlight={params.get('rx')} />
    </section>
  );
}
