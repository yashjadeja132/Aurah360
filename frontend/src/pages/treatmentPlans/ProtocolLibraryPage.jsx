import { useTranslation } from 'react-i18next';
import { ProtocolLibraryPanel } from '@/modules/treatmentPlans/components/ProtocolLibraryPanel';

/** Thin wrapper — body shared with the Treatments hub's Protocols tab. */
export default function ProtocolLibraryPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">
        {t('treatmentPlans.protocolLibrary.title', 'Protocol Library')}
      </h1>
      <ProtocolLibraryPanel />
    </section>
  );
}
