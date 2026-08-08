import { useTranslation } from 'react-i18next';
import { PackageBuilderPanel } from '@/modules/treatmentPlans/components/PackageBuilderPanel';

/** Thin wrapper — body shared with the Treatments hub's Packages tab. */
export default function PackageBuilderPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">
        {t('treatmentPlans.packageBuilder.title', 'Package Builder')}
      </h1>
      <PackageBuilderPanel />
    </section>
  );
}
