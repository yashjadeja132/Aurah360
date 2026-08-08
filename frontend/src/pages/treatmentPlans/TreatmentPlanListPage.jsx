import { useTranslation } from 'react-i18next';
import { TreatmentPlanListPanel } from '@/modules/treatmentPlans/components/TreatmentPlanListPanel';

/**
 * Thin wrapper kept for the standalone `/treatment-plans` route, which other modules still deep
 * link into (e.g. `?consultationId=…` from the consultation workspace). The body now lives in
 * `TreatmentPlanListPanel` and is shared with the Treatments hub's Plans tab — one implementation,
 * two mount points.
 */
export default function TreatmentPlanListPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">
        {t('treatmentPlans.list.title', 'Treatment Plans')}
      </h1>
      <TreatmentPlanListPanel />
    </section>
  );
}
