import { useTranslation } from 'react-i18next';
import { CrmRecallPanel } from '@/modules/crm/components/CrmRecallPanel';

/** DEPRECATED — superseded by CrmHubPage (`/crm?tab=recalls`). Thin wrapper. */
export default function RecallWorklistPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">{t('crm.recall.title', 'Recall worklist')}</h1>
      <CrmRecallPanel />
    </section>
  );
}
