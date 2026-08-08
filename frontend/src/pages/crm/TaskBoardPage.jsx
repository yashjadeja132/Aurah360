import { useTranslation } from 'react-i18next';
import { CrmFollowUpsPanel } from '@/modules/crm/components/CrmFollowUpsPanel';

/** DEPRECATED — superseded by CrmHubPage (`/crm?tab=followups`). Thin wrapper. */
export default function TaskBoardPage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-primary">{t('crm.taskBoard.title', 'Follow-up tasks')}</h1>
      <CrmFollowUpsPanel />
    </section>
  );
}
