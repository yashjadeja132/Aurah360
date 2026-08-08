import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useCrmTasks, useCreateTask, useUpdateTask, useLeads } from '@/modules/crm/hooks/useCrm';
import { leadDetailPath } from '@/constants/routes';

/** Follow-up task board (was TaskBoardPage). */
export function CrmFollowUpsPanel() {
  const { t } = useTranslation();
  const { data, isLoading } = useCrmTasks({ limit: 50 });
  const { data: leadsData } = useLeads({ limit: 20 });
  const create = useCreateTask();
  const update = useUpdateTask();
  const tasks = data?.items || [];
  const leads = leadsData?.items || [];

  const [leadId, setLeadId] = useState('');
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('CRM_EXECUTIVE');

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('crm.taskBoard.subtitle', 'Follow-up tasks assigned by role, with due dates and reminders')}
      </p>

      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-4">
        <select
          className="h-10 rounded-md border px-3 text-sm"
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
        >
          <option value="">{t('crm.taskBoard.leadLabel', 'Lead')}</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.leadNumber} · {l.fullName}
            </option>
          ))}
        </select>
        <Input
          placeholder={t('crm.taskBoard.taskTitlePlaceholder', 'Task title')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="h-10 rounded-md border px-3 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {['RECEPTION', 'CRM_EXECUTIVE', 'DOCTOR', 'BRANCH_MANAGER'].map((r) => (
            <option key={r} value={r}>
              {t(`crm.taskBoard.roles.${r}`, r)}
            </option>
          ))}
        </select>
        <Button
          disabled={!leadId || !title || create.isPending}
          onClick={() =>
            create.mutate(
              {
                leadId,
                title,
                assigneeRole: role,
                dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
                reminderAt: new Date(Date.now() + 2 * 86400000 - 3600000).toISOString(),
              },
              {
                onSuccess: () => {
                  setTitle('');
                },
              }
            )
          }
        >
          {t('crm.taskBoard.addTask', 'Add task')}
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-32 w-full" />}
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">{task.title}</p>
              <p className="text-xs text-muted-foreground">
                {task.lead ? (
                  <Link className="underline" to={leadDetailPath(task.lead.id)}>
                    {task.lead.leadNumber}
                  </Link>
                ) : (
                  task.leadId
                )}{' '}
                · {task.assigneeRole || '—'} · {t('crm.taskBoard.due', 'Due')}{' '}
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{task.status}</Badge>
              {task.status !== 'DONE' && (
                <Button size="sm" variant="outline" onClick={() => update.mutate({ id: task.id, status: 'DONE' })}>
                  {t('crm.taskBoard.done', 'Done')}
                </Button>
              )}
            </div>
          </div>
        ))}
        {!tasks.length && !isLoading && (
          <EmptyState title={t('crm.taskBoard.empty', 'No follow-up tasks yet.')} />
        )}
      </div>
    </div>
  );
}

export default CrmFollowUpsPanel;
