import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { consultationWorkspacePath } from '@/constants/routes';
import {
  useFollowUpQueue,
  useUpdateFollowUpStatus,
} from '@/modules/consultations/hooks/useConsultations';
import { FOLLOW_UP_STATUS_LABELS } from '@/modules/consultations/constants';

const PRIORITY_VARIANTS = {
  LOW: 'secondary',
  NORMAL: 'outline',
  HIGH: 'warning',
  URGENT: 'destructive',
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/**
 * §5 — the doctor's cross-patient Follow-ups due/overdue worklist. Follow-up orders were
 * previously only visible one consultation at a time (§3.6's inline tab), so there was no way to
 * see "who is due for a follow-up" across patients. Kept deliberately simple: open the
 * consultation to adjust the plan itself, or mark done/reschedule right from the row — the full
 * follow-up authoring UX stays in the consultation workspace.
 */
export default function FollowUpsQueuePage() {
  const { t } = useTranslation();
  const [scope, setScope] = useState('DUE');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useFollowUpQueue({ scope, page, limit: 25 });
  const rows = data?.items || [];
  const meta = data?.meta;
  const updateStatus = useUpdateFollowUpStatus();

  const changeScope = (value) => {
    setScope(value);
    setPage(1);
  };

  const markDone = (row) => {
    updateStatus.mutate({ id: row.consultationId, status: 'DONE' });
  };

  const reschedule = (row) => {
    const input = window.prompt(
      t('consultations.followUpsQueue.reschedulePrompt', 'New reminder date (YYYY-MM-DD):'),
      row.dueDate ? new Date(row.dueDate).toISOString().slice(0, 10) : ''
    );
    if (!input) return;
    const next = new Date(input);
    if (Number.isNaN(next.getTime())) return;
    updateStatus.mutate({ id: row.consultationId, status: 'RESCHEDULED', reminderDate: next.toISOString() });
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('consultations.followUpsQueue.title', 'Follow-ups')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'consultations.followUpsQueue.subtitle',
            'Follow-up orders across all your patients, due or approaching, in one place.'
          )}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            {t('consultations.followUpsQueue.queue', 'Queue')}{' '}
            <Badge variant={scope === 'DUE' && rows.length ? 'destructive' : 'secondary'}>
              {meta?.total ?? rows.length}
            </Badge>
          </CardTitle>
          <Select value={scope} onChange={(e) => changeScope(e.target.value)} className="w-56">
            <option value="DUE">
              {t('consultations.followUpsQueue.dueScope', 'Due / approaching (7 days)')}
            </option>
            <option value="ALL">{t('consultations.followUpsQueue.allScope', 'All follow-ups')}</option>
          </Select>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {!isLoading && rows.length === 0 && (
            <EmptyState
              icon={CalendarClock}
              title={t('consultations.followUpsQueue.emptyTitle', 'Nothing due')}
              description={t(
                'consultations.followUpsQueue.emptyDescription',
                'No follow-ups are due or approaching right now.'
              )}
            />
          )}

          {!isLoading && rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('consultations.followUpsQueue.patient', 'Patient')}</TableHead>
                  <TableHead>{t('consultations.followUpsQueue.dueDate', 'Due date')}</TableHead>
                  <TableHead>{t('consultations.followUpsQueue.reason', 'Reason')}</TableHead>
                  <TableHead>{t('consultations.followUpsQueue.priority', 'Priority')}</TableHead>
                  <TableHead>{t('consultations.followUpsQueue.status', 'Status')}</TableHead>
                  <TableHead className="text-right">
                    {t('consultations.followUpsQueue.action', 'Action')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <p className="font-medium">{row.patient?.fullName || '—'}</p>
                      <p className="text-xs text-muted-foreground">{row.patient?.mrn || '—'}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className={row.overdue ? 'font-medium text-destructive' : undefined}>
                        {formatDate(row.dueDate)}
                      </span>
                      {row.overdue && (
                        <p className="text-xs text-destructive">
                          {t('consultations.followUpsQueue.overdue', 'Overdue')}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <p>{row.reason || '—'}</p>
                      {(row.preferredDoctor?.name || row.preferredBranch?.name) && (
                        <p className="text-xs text-muted-foreground">
                          {[row.preferredDoctor?.name, row.preferredBranch?.name]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={PRIORITY_VARIANTS[row.priority] || 'outline'}>
                        {t(`consultations.followUp.priorities.${row.priority}`, row.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === 'DONE' ? 'success' : 'outline'}>
                        {FOLLOW_UP_STATUS_LABELS[row.status] || row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to={`${consultationWorkspacePath(row.consultationId)}?section=followup`}>
                            {t('consultations.followUpsQueue.open', 'Open')}
                          </Link>
                        </Button>
                        {row.status !== 'DONE' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={updateStatus.isPending}
                              onClick={() => markDone(row)}
                            >
                              {t('consultations.followUpsQueue.markDone', 'Mark done')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={updateStatus.isPending}
                              onClick={() => reschedule(row)}
                            >
                              {t('consultations.followUpsQueue.reschedule', 'Reschedule')}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {meta && meta.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {t('consultations.followUpsQueue.pageOf', 'Page {{page}} of {{pages}}', {
                  page: meta.page,
                  pages: meta.pages,
                })}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={meta.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('consultations.followUpsQueue.previous', 'Previous')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={meta.page >= meta.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('consultations.followUpsQueue.next', 'Next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
