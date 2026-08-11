import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { consultationWorkspacePath } from '@/constants/routes';
import { LAB_ORDER_STATUS_LABELS } from '@/modules/consultations/constants';
import {
  useLabOrderReviewQueue,
  useUpdateLabOrderFromQueue,
} from '@/modules/consultations/hooks/useConsultations';

const STATUS_FILTERS = ['RESULT_RECEIVED', 'ORDERED', 'REVIEWED', 'CANCELLED'];

const STATUS_VARIANTS = {
  ORDERED: 'warning',
  RESULT_RECEIVED: 'info',
  REVIEWED: 'success',
  CANCELLED: 'destructive',
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/**
 * A13 — the doctor's cross-patient Report Review worklist. Lab orders were previously only
 * listable per consultation, so finding results waiting on a review meant opening each patient in
 * turn. Defaults to RESULT_RECEIVED (= awaiting doctor review); the review itself still happens in
 * the consultation workspace, which owns the signed-record rules.
 */
export default function ReportReviewQueuePage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('RESULT_RECEIVED');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useLabOrderReviewQueue({ status, page, limit: 25 });
  const rows = data?.items || [];
  const meta = data?.meta;
  const updateLabOrder = useUpdateLabOrderFromQueue();

  const changeStatus = (value) => {
    setStatus(value);
    setPage(1);
  };

  const markReviewed = (order) => {
    if (!order.consultationId) return;
    updateLabOrder.mutate({
      consultationId: order.consultationId,
      labOrderId: order.id,
      status: 'REVIEWED',
    });
  };

  const releaseHintToast = () =>
    toast.info(
      t(
        'consultations.reportReview.releaseHint',
        'Release to patient happens at the note level — pick which sections to release.'
      )
    );

  const statusLabel = (value) =>
    t(`consultations.labs.statusLabels.${value}`, LAB_ORDER_STATUS_LABELS[value] || value);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('consultations.reportReview.title', 'Report review')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'consultations.reportReview.subtitle',
            'Lab and report orders across all patients, so results waiting on your review are in one place.'
          )}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            {t('consultations.reportReview.queue', 'Queue')}{' '}
            <Badge variant={status === 'RESULT_RECEIVED' && rows.length ? 'destructive' : 'secondary'}>
              {meta?.total ?? rows.length}
            </Badge>
          </CardTitle>
          <Select value={status} onChange={(e) => changeStatus(e.target.value)} className="w-56">
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
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
              icon={FlaskConical}
              title={t('consultations.reportReview.emptyTitle', 'Nothing to review')}
              description={t(
                'consultations.reportReview.emptyDescription',
                'No report orders are in this state right now.'
              )}
            />
          )}

          {!isLoading && rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('consultations.reportReview.patient', 'Patient')}</TableHead>
                  <TableHead>{t('consultations.reportReview.test', 'Test')}</TableHead>
                  <TableHead>{t('consultations.reportReview.ordered', 'Ordered')}</TableHead>
                  <TableHead>{t('consultations.reportReview.received', 'Result received')}</TableHead>
                  <TableHead>{t('consultations.reportReview.doctor', 'Doctor')}</TableHead>
                  <TableHead>{t('consultations.reportReview.status', 'Status')}</TableHead>
                  <TableHead className="text-right">
                    {t('consultations.reportReview.action', 'Action')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>
                      <p className="font-medium">{order.patient?.fullName || '—'}</p>
                      <p className="text-xs text-muted-foreground">{order.patient?.mrn || '—'}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{order.testName}</p>
                      {order.provider && (
                        <p className="text-xs text-muted-foreground">{order.provider}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(order.orderedAt)}</TableCell>
                    <TableCell className="text-sm">{formatDate(order.resultReceivedAt)}</TableCell>
                    <TableCell className="text-sm">
                      {order.doctor?.name || '—'}
                      {order.branch?.name && (
                        <p className="text-xs text-muted-foreground">{order.branch.name}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[order.status] || 'secondary'}>
                        {statusLabel(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {order.consultationId ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {order.status === 'RESULT_RECEIVED' && (
                            <Button
                              size="sm"
                              variant="default"
                              disabled={updateLabOrder.isPending}
                              onClick={() => markReviewed(order)}
                            >
                              {t('consultations.reportReview.markReviewed', 'Mark reviewed')}
                            </Button>
                          )}
                          <Button asChild size="sm" variant="outline" onClick={releaseHintToast}>
                            <Link
                              to={`${consultationWorkspacePath(order.consultationId)}?section=release`}
                            >
                              {t('consultations.reportReview.release', 'Release to patient')}
                            </Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link to={consultationWorkspacePath(order.consultationId)}>
                              {t('consultations.reportReview.open', 'Open consultation')}
                            </Link>
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {meta && meta.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {t('consultations.reportReview.pageOf', 'Page {{page}} of {{pages}}', {
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
                  {t('consultations.reportReview.previous', 'Previous')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={meta.page >= meta.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('consultations.reportReview.next', 'Next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
