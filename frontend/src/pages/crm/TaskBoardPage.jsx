import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  useCrmTasks,
  useCreateTask,
  useUpdateTask,
  useLeads,
} from '@/modules/crm/hooks/useCrm';
import { leadDetailPath } from '@/constants/routes';

export default function TaskBoardPage() {
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
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('crm.taskBoard.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('crm.taskBoard.subtitle')}
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-4">
        <select
          className="h-10 rounded-md border px-3 text-sm"
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
        >
          <option value="">{t('crm.taskBoard.leadLabel')}</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.leadNumber} · {l.fullName}
            </option>
          ))}
        </select>
        <Input placeholder={t('crm.taskBoard.taskTitlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} />
        <select
          className="h-10 rounded-md border px-3 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {['RECEPTION', 'CRM_EXECUTIVE', 'DOCTOR', 'BRANCH_MANAGER'].map((r) => (
            <option key={r} value={r}>
              {t(`crm.taskBoard.roles.${r}`)}
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
          {t('crm.taskBoard.addTask')}
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
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
                · {task.assigneeRole || '—'} · {t('crm.taskBoard.due')}{' '}
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{task.status}</Badge>
              {task.status !== 'DONE' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => update.mutate({ id: task.id, status: 'DONE' })}
                >
                  {t('crm.taskBoard.done')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
