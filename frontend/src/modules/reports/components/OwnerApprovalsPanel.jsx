import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissions';
import { PERMISSIONS } from '@/constants/rbac';
import { APP_ROUTES } from '@/constants/routes';
import { formatMoney } from '@/modules/reports/constants';
import { useDiscountApprovalQueue } from '@/modules/billing/hooks/useBilling';
import { useCashCloses } from '@/modules/billing/hooks/useBillingOps';
import { useAdjustmentQueue } from '@/modules/loyalty/hooks/useLoyalty';

/**
 * Everything awaiting the owner's sign-off, on the landing screen.
 *
 * Read-only reuse of the queues that already exist — no new endpoints and no
 * changes to the billing/loyalty modules. Each section deep-links to the screen
 * that already owns the approve/reject flow (those flows require a mandatory
 * decision note, so they are not duplicated here).
 */
function QueueSection({ title, count, isLoading, emptyLabel, actionLabel, actionTo, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {title}
          <Badge variant={count ? 'destructive' : 'secondary'}>{isLoading ? '…' : count}</Badge>
        </h3>
        {count > 0 && (
          <Button asChild size="sm" variant="outline">
            <Link to={actionTo}>{actionLabel}</Link>
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : count ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
          {emptyLabel}
        </p>
      )}
    </div>
  );
}

function Row({ primary, secondary, trailing }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{primary}</p>
        {secondary && <p className="truncate text-xs text-muted-foreground">{secondary}</p>}
      </div>
      {trailing && <span className="shrink-0 text-sm font-medium">{trailing}</span>}
    </div>
  );
}

export function OwnerApprovalsPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const canApproveDiscounts = hasAnyPermission(user?.permissions, [
    PERMISSIONS.BILLING_DISCOUNT_APPROVE,
    PERMISSIONS.BILLING_ALL,
  ]);
  const canApproveCashClose = hasAnyPermission(user?.permissions, [
    PERMISSIONS.BILLING_CASH_CLOSE_APPROVE,
    PERMISSIONS.BILLING_ALL,
  ]);
  const canApproveLoyalty = hasAnyPermission(user?.permissions, [
    PERMISSIONS.LOYALTY_ADJUST_APPROVE,
    PERMISSIONS.LOYALTY_ALL,
  ]);

  const discounts = useDiscountApprovalQueue(
    canApproveDiscounts ? { status: 'PENDING_APPROVAL', limit: 100 } : {}
  );
  const adjustments = useAdjustmentQueue(
    canApproveLoyalty ? { status: 'PENDING_APPROVAL' } : {}
  );
  const closes = useCashCloses({});

  const discountRows = canApproveDiscounts ? discounts.data?.items || [] : [];
  const adjustmentRows = canApproveLoyalty ? adjustments.data?.items || [] : [];
  const closeRows = canApproveCashClose
    ? (closes.data || []).filter((c) => c.status === 'SUBMITTED')
    : [];

  const total = discountRows.length + adjustmentRows.length + closeRows.length;
  const anyGate = canApproveDiscounts || canApproveLoyalty || canApproveCashClose;

  if (!anyGate) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-primary" />
          {t('owner.landing.awaitingSignOff', 'Awaiting your sign-off')}
          <Badge variant={total ? 'destructive' : 'success'}>{total}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {total === 0 && (
          <EmptyState
            icon={BadgeCheck}
            title={t('owner.landing.allClear', 'All clear')}
            description={t(
              'owner.landing.allClearHint',
              'Nothing is waiting on your approval right now.'
            )}
          />
        )}

        {canApproveDiscounts && (
          <QueueSection
            title={t('owner.landing.discountApprovals', 'Discount approvals')}
            count={discountRows.length}
            isLoading={discounts.isLoading}
            emptyLabel={t('owner.landing.noDiscounts', 'No discounts waiting on a decision.')}
            actionLabel={t('owner.landing.review', 'Review')}
            actionTo={APP_ROUTES.BILLING_DISCOUNT_APPROVALS}
          >
            {discountRows.slice(0, 5).map((inv) => (
              <Row
                key={inv.id}
                primary={`${inv.invoiceNumber} · ${inv.patient?.fullName || '—'}`}
                secondary={`${inv.branch?.name || '—'} · ${t(
                  'owner.landing.discountOfSubtotal',
                  '{{percent}}% of subtotal',
                  { percent: inv.discountPercent ?? 0 }
                )}`}
                trailing={formatMoney(inv.discount)}
              />
            ))}
          </QueueSection>
        )}

        {canApproveLoyalty && (
          <QueueSection
            title={t('owner.landing.loyaltyAdjustments', 'Loyalty manual adjustments')}
            count={adjustmentRows.length}
            isLoading={adjustments.isLoading}
            emptyLabel={t('owner.landing.noAdjustments', 'No manual point adjustments waiting.')}
            actionLabel={t('owner.landing.review', 'Review')}
            actionTo={APP_ROUTES.LOYALTY_ADJUSTMENTS}
          >
            {adjustmentRows.slice(0, 5).map((item) => (
              <Row
                key={item.id}
                primary={`${item.patient?.fullName || item.patientId} · ${item.points} ${t(
                  'owner.landing.points',
                  'points'
                )}`}
                secondary={`${item.reasonCategory || '—'} · ${item.note || '—'}`}
                trailing={item.entryType}
              />
            ))}
          </QueueSection>
        )}

        {canApproveCashClose && (
          <QueueSection
            title={t('owner.landing.cashCloseApprovals', 'Cash-close approvals')}
            count={closeRows.length}
            isLoading={closes.isLoading}
            emptyLabel={t('owner.landing.noCashCloses', 'No submitted cash closes to approve.')}
            actionLabel={t('owner.landing.review', 'Review')}
            actionTo={APP_ROUTES.BILLING_CASH_CLOSE}
          >
            {closeRows.slice(0, 5).map((c) => (
              <Row
                key={c.id}
                primary={
                  c.closeDate ? new Date(c.closeDate).toLocaleDateString() : t('owner.landing.cashClose', 'Cash close')
                }
                secondary={t('owner.landing.varianceLabel', 'Variance {{value}}', {
                  value: formatMoney(c.variance),
                })}
                trailing={formatMoney(c.countedCash)}
              />
            ))}
          </QueueSection>
        )}
      </CardContent>
    </Card>
  );
}

export default OwnerApprovalsPanel;
