import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { treatmentPlanEditPath } from '@/constants/routes';
import { TreatmentPlanForm } from '@/modules/treatmentPlans/components/TreatmentPlanForm';
import {
  usePendingApprovalQueue,
  useApprovePlan,
  useHoldPlan,
  useUnholdPlan,
  useEscalatePlan,
} from '@/modules/treatmentPlans/hooks/useTreatmentPlans';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/** One row's action buttons — each mutation hook is bound to this row's plan id. */
function QueueRow({ order, expanded, onToggleExpand, onEscalate }) {
  const { t } = useTranslation();
  const approve = useApprovePlan(order.id);
  const hold = useHoldPlan(order.id);
  const unhold = useUnholdPlan(order.id);
  const [holdNote, setHoldNote] = useState('');
  const [showHoldBox, setShowHoldBox] = useState(false);

  return (
    <>
      <TableRow>
        <TableCell>
          <p className="font-medium">{order.patient?.fullName || '—'}</p>
          <p className="text-xs text-muted-foreground">{order.patient?.mrn || '—'}</p>
        </TableCell>
        <TableCell>
          <p className="font-medium">{order.title}</p>
          <p className="text-xs text-muted-foreground">{order.planNumber}</p>
        </TableCell>
        <TableCell className="text-sm">{order.doctor?.name || '—'}</TableCell>
        <TableCell className="text-sm">{formatDate(order.createdAt)}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            <Badge variant="secondary">{order.status}</Badge>
            {order.onHold && <Badge variant="warning">{t('treatmentPlans.approvalQueue.onHold', 'On hold')}</Badge>}
            {order.escalatedAt && (
              <Badge variant="destructive">{t('treatmentPlans.approvalQueue.escalated', 'Escalated')}</Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex flex-wrap justify-end gap-1.5">
            <PermissionGuard permissions={[PERMISSIONS.TREATMENT_PLAN_APPROVE, PERMISSIONS.TREATMENT_PLAN_ALL]}>
              <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate()}>
                {t('treatmentPlans.approvalQueue.approve', 'Approve')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onToggleExpand(order.id)}>
                {expanded ? t('treatmentPlans.approvalQueue.hideModify', 'Hide') : t('treatmentPlans.approvalQueue.modify', 'Modify')}
              </Button>
              {order.onHold ? (
                <Button size="sm" variant="outline" disabled={unhold.isPending} onClick={() => unhold.mutate()}>
                  {t('treatmentPlans.approvalQueue.unhold', 'Clear hold')}
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowHoldBox((v) => !v)}>
                  {t('treatmentPlans.approvalQueue.hold', 'Hold')}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => onEscalate(order.id)}>
                {t('treatmentPlans.approvalQueue.escalate', 'Escalate')}
              </Button>
            </PermissionGuard>
            <Button asChild size="sm" variant="ghost">
              <Link to={treatmentPlanEditPath(order.id)}>
                {t('treatmentPlans.approvalQueue.openFull', 'Open full page')}
              </Link>
            </Button>
          </div>
          {showHoldBox && (
            <div className="mt-2 flex items-center justify-end gap-2">
              <Input
                className="w-56"
                placeholder={t('treatmentPlans.approvalQueue.holdNotePlaceholder', 'Why is this parked? (optional)')}
                value={holdNote}
                onChange={(e) => setHoldNote(e.target.value)}
              />
              <Button
                size="sm"
                disabled={hold.isPending}
                onClick={() =>
                  hold.mutate(holdNote || null, {
                    onSuccess: () => {
                      setShowHoldBox(false);
                      setHoldNote('');
                    },
                  })
                }
              >
                {t('treatmentPlans.approvalQueue.confirmHold', 'Confirm hold')}
              </Button>
            </div>
          )}
          {order.holdNote && (
            <p className="mt-1 text-right text-xs text-muted-foreground">{order.holdNote}</p>
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/20 p-4">
            {/* Same wizard/hooks as the standalone Treatment Plan builder — "Modify" just opens it
                inline instead of navigating away from the queue. */}
            <TreatmentPlanForm planId={order.id} embedded />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * §3.5's approval gap: previously "Approve" was a single button on step 6 of the plan wizard with
 * no cross-patient view. This is the doctor's/owner's worklist of DRAFT/RECOMMENDED plans across
 * ALL their patients, mirroring ReportReviewQueuePage's list pattern (same pagination shape, same
 * cross-patient scoping via the backend's scopedListQuery).
 */
export default function TreatmentPlanApprovalQueuePage() {
  const { t } = useTranslation();
  const [onHoldFilter, setOnHoldFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [escalatingId, setEscalatingId] = useState(null);
  const [escalationReason, setEscalationReason] = useState('');

  const params = { page, limit: 25, ...(onHoldFilter ? { onHold: onHoldFilter } : {}) };
  const { data, isLoading } = usePendingApprovalQueue(params);
  const escalate = useEscalatePlan(escalatingId);
  const rows = data?.items || [];
  const meta = data?.meta;

  const toggleExpand = (id) => setExpandedId((cur) => (cur === id ? null : id));

  const submitEscalation = () => {
    escalate.mutate(
      { reason: escalationReason || null },
      {
        onSuccess: () => {
          setEscalatingId(null);
          setEscalationReason('');
        },
      }
    );
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('treatmentPlans.approvalQueue.title', 'Treatment plans awaiting approval')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'treatmentPlans.approvalQueue.subtitle',
            'Draft and recommended plans across your patients — approve, modify, hold, or escalate without opening each one separately.'
          )}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            {t('treatmentPlans.approvalQueue.queue', 'Queue')}{' '}
            <Badge variant={rows.length ? 'destructive' : 'secondary'}>{meta?.total ?? rows.length}</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={onHoldFilter === '' ? 'default' : 'outline'}
              onClick={() => { setOnHoldFilter(''); setPage(1); }}
            >
              {t('treatmentPlans.approvalQueue.filterAll', 'All')}
            </Button>
            <Button
              size="sm"
              variant={onHoldFilter === 'true' ? 'default' : 'outline'}
              onClick={() => { setOnHoldFilter('true'); setPage(1); }}
            >
              {t('treatmentPlans.approvalQueue.filterOnHold', 'On hold')}
            </Button>
          </div>
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
              icon={Stethoscope}
              title={t('treatmentPlans.approvalQueue.emptyTitle', 'Nothing awaiting approval')}
              description={t(
                'treatmentPlans.approvalQueue.emptyDescription',
                'Draft or recommended treatment plans will show up here.'
              )}
            />
          )}

          {!isLoading && rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('treatmentPlans.approvalQueue.patient', 'Patient')}</TableHead>
                  <TableHead>{t('treatmentPlans.approvalQueue.plan', 'Plan')}</TableHead>
                  <TableHead>{t('treatmentPlans.approvalQueue.doctor', 'Doctor')}</TableHead>
                  <TableHead>{t('treatmentPlans.approvalQueue.created', 'Created')}</TableHead>
                  <TableHead>{t('treatmentPlans.approvalQueue.status', 'Status')}</TableHead>
                  <TableHead className="text-right">{t('treatmentPlans.approvalQueue.action', 'Action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((order) => (
                  <QueueRow
                    key={order.id}
                    order={order}
                    expanded={expandedId === order.id}
                    onToggleExpand={toggleExpand}
                    onEscalate={setEscalatingId}
                  />
                ))}
              </TableBody>
            </Table>
          )}

          {meta && meta.pages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {t('treatmentPlans.approvalQueue.pageOf', 'Page {{page}} of {{pages}}', {
                  page: meta.page,
                  pages: meta.pages,
                })}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={meta.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  {t('treatmentPlans.approvalQueue.previous', 'Previous')}
                </Button>
                <Button size="sm" variant="outline" disabled={meta.page >= meta.pages} onClick={() => setPage((p) => p + 1)}>
                  {t('treatmentPlans.approvalQueue.next', 'Next')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {escalatingId && (
        <Card>
          <CardHeader>
            <CardTitle>{t('treatmentPlans.approvalQueue.escalateTitle', 'Escalate for senior/owner review')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {t(
                'treatmentPlans.approvalQueue.escalateHint',
                'This codebase has no staff picker a doctor can call, so escalation flags the plan with a reason for whoever picks it up next — it does not assign a specific person yet.'
              )}
            </p>
            <Input
              placeholder={t('treatmentPlans.approvalQueue.escalateReasonPlaceholder', 'Reason for escalation')}
              value={escalationReason}
              onChange={(e) => setEscalationReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button disabled={escalate.isPending} onClick={submitEscalation}>
                {t('treatmentPlans.approvalQueue.confirmEscalate', 'Confirm escalation')}
              </Button>
              <Button variant="ghost" onClick={() => setEscalatingId(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
