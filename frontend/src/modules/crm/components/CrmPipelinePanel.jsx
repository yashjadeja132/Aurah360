import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { usePipeline, useChangeLeadStatus } from '@/modules/crm/hooks/useCrm';
import { PIPELINE_COLUMNS } from '@/modules/crm/constants';
import { leadDetailPath } from '@/constants/routes';

/** Drag-and-drop lead pipeline (was KanbanPipelinePage). */
export function CrmPipelinePanel() {
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
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('crm.pipeline.subtitle', 'Drag a lead between stages to change its status')}
      </p>

      {isLoading && <Skeleton className="h-48 w-full" />}

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
                {t(`crm.leadStatus.${status}`, status)}
              </p>
              <span className="text-xs text-muted-foreground">{(columns[status] || []).length}</span>
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
    </div>
  );
}

export default CrmPipelinePanel;
