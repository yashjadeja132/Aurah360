import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePipeline, useChangeLeadStatus } from '@/modules/crm/hooks/useCrm';
import { PIPELINE_COLUMNS } from '@/modules/crm/constants';
import { leadDetailPath } from '@/constants/routes';

export default function KanbanPipelinePage() {
  const { t } = useTranslation();
  const { data, isLoading } = usePipeline();
  const changeStatus = useChangeLeadStatus();
  const columns = data?.columns || {};
  const [draggingId, setDraggingId] = useState(null);

  const onDrop = (status) => {
    if (!draggingId) return;
    changeStatus.mutate({ id: draggingId, status });
    setDraggingId(null);
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('crm.pipeline.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('crm.pipeline.subtitle')}
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_COLUMNS.map((status) => (
          <div
            key={status}
            className="min-w-[220px] flex-1 rounded-xl border bg-muted/20 p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(status)}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide">
                {t(`crm.leadStatus.${status}`)}
              </p>
              <span className="text-xs text-muted-foreground">
                {(columns[status] || []).length}
              </span>
            </div>
            <div className="space-y-2">
              {(columns[status] || []).map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={() => setDraggingId(lead.id)}
                  className="cursor-grab rounded-lg border bg-card p-3 shadow-sm active:cursor-grabbing"
                >
                  <Link to={leadDetailPath(lead.id)} className="font-medium hover:underline">
                    {lead.fullName}
                  </Link>
                  <p className="text-xs text-muted-foreground">{lead.leadNumber}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lead.source || '—'} · {lead.priority}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
