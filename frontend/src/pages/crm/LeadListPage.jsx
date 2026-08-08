import { useTranslation } from 'react-i18next';
import { CrmLeadsPanel } from '@/modules/crm/components/CrmLeadsPanel';

/** DEPRECATED — superseded by CrmHubPage (`/crm?tab=leads`). Thin wrapper. */
export default function LeadListPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">{t('crm.leadList.title', 'Leads')}</h1>
      <CrmLeadsPanel />
    </section>
  );
}
