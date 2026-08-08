import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { LAB_ORDER_STATUS_LABELS } from '../constants';
import {
  useConsultationLabOrders,
  useCreateLabOrder,
  useUpdateLabOrder,
} from '../hooks/useConsultations';
import { useInsertTarget } from '../hooks/useInsertTarget';
import { INSERT_TARGETS } from '../insertBus';

const STATUS_VARIANTS = {
  ORDERED: 'warning',
  RESULT_RECEIVED: 'info',
  REVIEWED: 'success',
  CANCELLED: 'destructive',
};

const EMPTY_FORM = { testName: '', reason: '', provider: '', dueDate: '' };

export function LabOrdersPanel({ consultationId, readOnly }) {
  const { t } = useTranslation();
  const ordersQuery = useConsultationLabOrders(consultationId);
  const create = useCreateLabOrder(consultationId);
  const update = useUpdateLabOrder(consultationId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [reviewComment, setReviewComment] = useState({});

  const orders = ordersQuery.data || [];

  /**
   * An accepted copilot investigation only PRE-FILLS the order form — the doctor still submits it,
   * so no lab order is ever placed by the AI.
   */
  useInsertTarget(
    INSERT_TARGETS.LAB_ORDER,
    ({ testName, reason }) =>
      setForm((prev) => ({ ...prev, testName: testName || prev.testName, reason: reason || prev.reason })),
    !readOnly
  );

  const statusLabel = (status) =>
    t(`consultations.labs.statusLabels.${status}`, LAB_ORDER_STATUS_LABELS[status] || status);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.testName.trim()) return;
    await create.mutateAsync({
      testName: form.testName.trim(),
      reason: form.reason.trim() || null,
      provider: form.provider.trim() || null,
      dueDate: form.dueDate || null,
    });
    setForm(EMPTY_FORM);
  };

  const transition = (order, status) =>
    update.mutate({
      labOrderId: order.id,
      status,
      ...(status === 'REVIEWED' && reviewComment[order.id]
        ? { reviewComment: reviewComment[order.id] }
        : {}),
    });

  const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t('consultations.labs.title', 'Lab orders')}</h3>
      <p className="text-xs text-muted-foreground">
        {t(
          'consultations.labs.hint',
          'Order investigations, record incoming results, then mark them doctor reviewed.'
        )}
      </p>

      {!readOnly && (
        <PermissionGuard
          permissions={[PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL]}
        >
          <form onSubmit={onSubmit} className="space-y-3 rounded-lg border p-3">
            <div className="space-y-1">
              <Label>{t('consultations.labs.testName', 'Test name')}</Label>
              <Input
                value={form.testName}
                onChange={(e) => setForm((p) => ({ ...p, testName: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{t('consultations.labs.provider', 'Lab / provider')}</Label>
                <Input
                  value={form.provider}
                  onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('consultations.labs.dueDate', 'Due date')}</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('consultations.labs.reason', 'Clinical reason')}</Label>
              <Input
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={!form.testName.trim() || create.isPending}>
              {t('consultations.labs.order', 'Order test')}
            </Button>
          </form>
        </PermissionGuard>
      )}

      {ordersQuery.isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {ordersQuery.isError && (
        <p className="text-sm text-destructive">
          {ordersQuery.error?.response?.data?.message ||
            t('consultations.labs.loadFailed', 'Failed to load lab orders')}
        </p>
      )}

      {!ordersQuery.isLoading && !ordersQuery.isError && !orders.length && (
        <EmptyState
          icon={FlaskConical}
          title={t('consultations.labs.emptyTitle', 'No lab orders yet')}
          description={t(
            'consultations.labs.emptyDescription',
            'Investigations ordered for this consultation will be tracked here.'
          )}
        />
      )}

      {orders.length > 0 && (
        <div className="space-y-2">
          {orders.map((order) => (
            <div key={order.id} className="space-y-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{order.testName}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.provider || t('consultations.labs.noProvider', 'No provider')} ·{' '}
                    {t('consultations.labs.due', 'Due')} {formatDate(order.dueDate)}
                  </p>
                  {order.reason && (
                    <p className="text-xs text-muted-foreground">{order.reason}</p>
                  )}
                </div>
                <Badge variant={STATUS_VARIANTS[order.status] || 'outline'}>
                  {statusLabel(order.status)}
                </Badge>
              </div>

              <div className="grid gap-x-4 text-xs text-muted-foreground sm:grid-cols-2">
                <span>
                  {t('consultations.labs.resultReceivedAt', 'Result received')}:{' '}
                  {formatDate(order.resultReceivedAt)}
                </span>
                <span>
                  {t('consultations.labs.reviewedAt', 'Reviewed')}: {formatDate(order.reviewedAt)}
                </span>
              </div>
              {order.reviewComment && (
                <p className="text-xs text-foreground">{order.reviewComment}</p>
              )}

              {!readOnly && order.status !== 'REVIEWED' && order.status !== 'CANCELLED' && (
                <PermissionGuard
                  permissions={[PERMISSIONS.CONSULTATION_EDIT, PERMISSIONS.CONSULTATION_ALL]}
                >
                  <div className="space-y-2 border-t pt-2">
                    {order.status === 'RESULT_RECEIVED' && (
                      <Input
                        value={reviewComment[order.id] || ''}
                        placeholder={t(
                          'consultations.labs.reviewCommentPlaceholder',
                          'Review comment (optional)'
                        )}
                        onChange={(e) =>
                          setReviewComment((p) => ({ ...p, [order.id]: e.target.value }))
                        }
                      />
                    )}
                    <div className="flex flex-wrap gap-2">
                      {order.status === 'ORDERED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={update.isPending}
                          onClick={() => transition(order, 'RESULT_RECEIVED')}
                        >
                          {t('consultations.labs.markResultReceived', 'Mark result received')}
                        </Button>
                      )}
                      {order.status === 'RESULT_RECEIVED' && (
                        <Button
                          size="sm"
                          disabled={update.isPending}
                          onClick={() => transition(order, 'REVIEWED')}
                        >
                          {t('consultations.labs.markReviewed', 'Mark doctor reviewed')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={update.isPending}
                        onClick={() => transition(order, 'CANCELLED')}
                      >
                        {t('consultations.labs.cancel', 'Cancel order')}
                      </Button>
                    </div>
                  </div>
                </PermissionGuard>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
