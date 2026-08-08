import { useTranslation } from 'react-i18next';
import { CrmPipelinePanel } from '@/modules/crm/components/CrmPipelinePanel';

/** DEPRECATED — superseded by CrmHubPage (`/crm?tab=pipeline`). Thin wrapper. */
export default function KanbanPipelinePage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-4">
      <h1 className="font-display text-3xl font-semibold text-primary">{t('crm.pipeline.title', 'Pipeline')}</h1>
      <CrmPipelinePanel />
    </section>
  );
}
