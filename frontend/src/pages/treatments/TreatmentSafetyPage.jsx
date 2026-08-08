import { useTranslation } from 'react-i18next';
import { AdverseEventRegisterPanel } from '@/modules/treatmentSafety/components/AdverseEventRegisterPanel';

/**
 * Thin wrapper — body shared with the Treatments hub's Safety tab.
 * TRT-006: patch tests are recorded from the treatment session workspace; this register tracks
 * adverse events, which must never be hidden by completing billing (§10.3).
 */
export default function TreatmentSafetyPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">
        {t('treatments.safety.title', 'Treatment safety')}
      </h1>
      <AdverseEventRegisterPanel />
    </section>
  );
}
