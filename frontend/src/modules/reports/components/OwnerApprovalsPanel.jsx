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
import { useDiscountApprovalQueue, useRefundApprovalQueue } from '@/modules/billing/hooks/useBilling';
import { useCashCloses } from '@/modules/billing/hooks/useBillingOps';
import { useAdjustmentQueue } from '@/modules/loyalty/hooks/useLoyalty';
import { useBreakGlassGrants } from '@/modules/privacy/hooks/usePrivacy';
import { useAuditSearch } from '@/modules/audit/hooks/useAuditLog';

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
  const canApproveRefunds = hasAnyPermission(user?.permissions, [
    PERMISSIONS.BILLING_REFUND_APPROVE,
    PERMISSIONS.BILLING_ALL,
  ]);
  const canReviewBreakGlass = hasAnyPermission(user?.permissions, [
    PERMISSIONS.BREAK_GLASS,
    PERMISSIONS.AUDIT_VIEW,
  ]);
  // §7 "Roster override conflicts" — read-only history, sourced from the audit trail, so it is
  // gated on the same permission that trail's own search endpoint enforces (audit.view). Doctor
  // schedule/leave edit permissions alone would not be enough to actually read the entries.
  const canReviewRosterOverrides = hasAnyPermission(user?.permissions, [
    PERMISSIONS.AUDIT_VIEW,
    PERMISSIONS.DOCTOR_SCHEDULE_ALL,
    PERMISSIONS.DOCTOR_LEAVE_ALL,
  ]);

  const discounts = useDiscountApprovalQueue(
    canApproveDiscounts ? { status: 'PENDING_APPROVAL', limit: 100 } : {}
  );
  const refunds = useRefundApprovalQueue(
    canApproveRefunds ? { status: 'PENDING_APPROVAL', limit: 100 } : {}
  );
  const adjustments = useAdjustmentQueue(
    canApproveLoyalty ? { status: 'PENDING_APPROVAL' } : {}
  );
  const closes = useCashCloses({});
  const breakGlass = useBreakGlassGrants(canReviewBreakGlass ? {} : { limit: 0 });
  const rosterOverrides = useAuditSearch(
    { action: 'ROSTER_OVERRIDE_RECORDED', limit: 10 },
    { enabled: canReviewRosterOverrides }
  );

  const discountRows = canApproveDiscounts ? discounts.data?.items || [] : [];
  const refundRows = canApproveRefunds ? refunds.data?.items || [] : [];
  const adjustmentRows = canApproveLoyalty ? adjustments.data?.items || [] : [];
  const closeRows = canApproveCashClose
    ? (closes.data || []).filter((c) => c.status === 'SUBMITTED')
    : [];
  // Break-glass access is self-granted with a mandatory reason + short TTL, not a pending
  // decision — there is no approve/reject step in the backend by design (PrivacyGovernanceService
  // .grantBreakGlass). This surfaces currently-active grants for owner awareness/audit review,
  // same list endpoint the Privacy admin screen already uses.
  const activeBreakGlassRows = canReviewBreakGlass
    ? (breakGlass.data || []).filter((g) => !g.expiresAt || new Date(g.expiresAt) > new Date())
    : [];
  // §7 "Roster override conflicts" — awareness only, not a decision queue: the override already
  // happened (audited at write time by DoctorScheduleService/DoctorLeaveService), this just
  // surfaces the recent history for the owner. Same "surface it, don't gate it twice" pattern as
  // the break-glass section above.
  const rosterOverrideRows = canReviewRosterOverrides ? rosterOverrides.data?.entries || [] : [];

  const total = discountRows.length + refundRows.length + adjustmentRows.length + closeRows.length;
  const anyGate =
    canApproveDiscounts ||
    canApproveRefunds ||
    canApproveLoyalty ||
    canApproveCashClose ||
    canReviewBreakGlass ||
    canReviewRosterOverrides;

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

        {canApproveRefunds && (
          <QueueSection
            title={t('owner.landing.refundApprovals', 'Refund approvals')}
            count={refundRows.length}
            isLoading={refunds.isLoading}
            emptyLabel={t('owner.landing.noRefunds', 'No refunds waiting on a decision.')}
            actionLabel={t('owner.landing.review', 'Review')}
            actionTo={APP_ROUTES.BILLING_REFUND_APPROVALS}
          >
            {refundRows.slice(0, 5).map((r) => (
              <Row
                key={r.id}
                primary={`${r.invoiceNumber || r.invoiceId} · ${r.patientName || '—'}`}
                secondary={r.reason || '—'}
                trailing={formatMoney(r.amount)}
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

        {canReviewBreakGlass && (
          <QueueSection
            title={t('owner.landing.breakGlassAccess', 'Active break-glass access')}
            count={activeBreakGlassRows.length}
            isLoading={breakGlass.isLoading}
            emptyLabel={t('owner.landing.noBreakGlass', 'No active break-glass grants right now.')}
            actionLabel={t('owner.landing.review', 'Review')}
            actionTo={APP_ROUTES.SETTINGS_PRIVACY}
          >
            {activeBreakGlassRows.slice(0, 5).map((g) => (
              <Row
                key={g.id || g._id}
                primary={`${g.resourceType || 'Patient record'} · ${g.patientId || '—'}`}
                secondary={g.reason || '—'}
                trailing={g.expiresAt ? new Date(g.expiresAt).toLocaleTimeString() : '—'}
              />
            ))}
          </QueueSection>
        )}

        {canReviewRosterOverrides && (
          <QueueSection
            title={t('owner.landing.rosterOverrides', 'Roster override conflicts')}
            count={rosterOverrideRows.length}
            isLoading={rosterOverrides.isLoading}
            emptyLabel={t(
              'owner.landing.noRosterOverrides',
              'No roster overrides recorded recently.'
            )}
            actionLabel={t('owner.landing.review', 'Review')}
            actionTo={APP_ROUTES.DOCTORS}
          >
            {rosterOverrideRows.slice(0, 5).map((entry) => (
              <Row
                key={entry.id}
                primary={t('owner.landing.rosterOverrideBy', 'Overridden by {{actor}}', {
                  actor: entry.actorId || '—',
                })}
                secondary={`${entry.metadata?.context || '—'} · ${entry.metadata?.reason || '—'}`}
                trailing={entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
              />
            ))}
          </QueueSection>
        )}
      </CardContent>
    </Card>
  );
}

export default OwnerApprovalsPanel;
