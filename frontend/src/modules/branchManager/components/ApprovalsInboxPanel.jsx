import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BadgePercent, Check, Inbox, Vault, Truck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useApproveCashClose } from '@/modules/billing/hooks/useBillingOps';
import { useApproveTransfer, useRejectTransfer } from '@/modules/inventory/hooks/useInventory';
import { formatMoney } from '@/modules/billing/constants';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

/**
 * B1 — the pending-approvals inbox. Three different things wait on a Branch Manager's signature and
 * they live in three different modules today; this puts all three counts in one place and lets the
 * two that have no manager-facing screen (cash-close submissions, stock transfer requests) be
 * decided right here.
 *
 * Discount approvals are counted here but decided in the full `DiscountApprovalPanel` rendered
 * further down the same page — that panel already carries the mandatory per-decision note, so
 * duplicating a cut-down version of it here would only lose the audit justification.
 *
 * Each action is permission-gated to the same permission its endpoint requires; BRANCH_MANAGER holds
 * all three (`billing.cash_close_approve`, `inventory.transfer_approve`, `billing.discount_approve`).
 */
export function ApprovalsInboxPanel({ approvals, onJumpToDiscounts }) {
  const { t } = useTranslation();
  const approveCashClose = useApproveCashClose();
  const approveTransfer = useApproveTransfer();
  const rejectTransfer = useRejectTransfer();

  // Rejecting a transfer requires a reason (the endpoint validates it), kept per-row.
  const [reasons, setReasons] = useState({});
  const setReason = (id, value) => setReasons((prev) => ({ ...prev, [id]: value }));

  const { discounts = [], cashCloses = [], transfers = [] } = approvals;
  const nothing = !approvals.isLoading && approvals.total === 0;

  return (
    <Card className={approvals.total > 0 ? 'border-warning/40' : undefined}>
      <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4" />
            {t('branchDay.approvals.title', 'Awaiting your approval')}
            {approvals.total > 0 && <Badge variant="destructive">{approvals.total}</Badge>}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('branchDay.approvals.summary', '{{discounts}} discount(s) · {{cash}} cash close(s) · {{transfers}} stock transfer(s)', {
              discounts: discounts.length,
              cash: cashCloses.length,
              transfers: transfers.length,
            })}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {approvals.isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {nothing && (
          <EmptyState
            icon={Check}
            title={t('branchDay.approvals.emptyTitle', 'Your inbox is clear')}
            description={t(
              'branchDay.approvals.emptyDescription',
              'No discount, cash close or stock transfer is waiting on you at this branch.'
            )}
          />
        )}

        {!approvals.isLoading && discounts.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <BadgePercent className="h-3.5 w-3.5" />
              {t('branchDay.approvals.discountHeading', 'Discounts blocking a bill')}
            </p>
            <ul className="divide-y">
              {discounts.slice(0, 5).map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{inv.invoiceNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t('branchDay.approvals.discountLine', '{{patient}} · {{percent}}% vs {{threshold}}% threshold · {{total}}', {
                        patient: inv.patient?.fullName || '—',
                        percent: inv.discountPercent ?? 0,
                        threshold: inv.thresholdPercent ?? 0,
                        total: formatMoney(inv.total),
                      })}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={onJumpToDiscounts}>
                    {t('branchDay.approvals.decide', 'Decide')}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!approvals.isLoading && cashCloses.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Vault className="h-3.5 w-3.5" />
              {t('branchDay.approvals.cashHeading', 'Cash closes submitted')}
            </p>
            <ul className="divide-y">
              {cashCloses.map((close) => (
                <li key={close.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{formatDate(close.closeDate)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('branchDay.approvals.cashLine', 'Counted {{counted}} vs expected {{expected}}', {
                        counted: formatMoney(close.countedCash),
                        expected: formatMoney(close.expectedCash),
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {Number(close.variance) !== 0 && (
                      <Badge variant={Number(close.variance) < 0 ? 'destructive' : 'warning'}>
                        {t('branchDay.approvals.variance', 'Variance {{amount}}', {
                          amount: formatMoney(close.variance),
                        })}
                      </Badge>
                    )}
                    <PermissionGuard
                      permissions={[PERMISSIONS.BILLING_CASH_CLOSE_APPROVE, PERMISSIONS.BILLING_ALL]}
                    >
                      <Button
                        size="sm"
                        disabled={approveCashClose.isPending}
                        onClick={() => approveCashClose.mutate(close.id)}
                      >
                        <Check className="h-4 w-4" />
                        {t('branchDay.approvals.approve', 'Approve')}
                      </Button>
                    </PermissionGuard>
                    <Button asChild size="sm" variant="ghost">
                      <Link to={APP_ROUTES.BILLING_CASH_CLOSE}>
                        {t('branchDay.approvals.openCashClose', 'Open')}
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!approvals.isLoading && transfers.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Truck className="h-3.5 w-3.5" />
              {t('branchDay.approvals.transferHeading', 'Stock transfers requested')}
            </p>
            <ul className="divide-y">
              {transfers.map((tr) => (
                <li key={tr.id} className="flex flex-col gap-2 py-2 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{tr.transferNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('branchDay.approvals.transferLine', 'Qty {{qty}}{{batch}} · requested {{date}}', {
                        qty: tr.quantityRequested ?? 0,
                        batch: tr.batchNumber ? ` · batch ${tr.batchNumber}` : '',
                        date: formatDate(tr.createdAt),
                      })}
                    </p>
                  </div>
                  <PermissionGuard
                    permissions={[
                      PERMISSIONS.INVENTORY_TRANSFER_APPROVE,
                      PERMISSIONS.INVENTORY_ALL,
                    ]}
                  >
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Input
                        className="h-9 w-full sm:w-44"
                        placeholder={t('branchDay.approvals.rejectReason', 'Reason (to reject)')}
                        value={reasons[tr.id] || ''}
                        onChange={(e) => setReason(tr.id, e.target.value)}
                      />
                      <Button
                        size="sm"
                        disabled={approveTransfer.isPending}
                        onClick={() => approveTransfer.mutate(tr.id)}
                      >
                        <Check className="h-4 w-4" />
                        {t('branchDay.approvals.approve', 'Approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={rejectTransfer.isPending || !String(reasons[tr.id] || '').trim()}
                        onClick={() =>
                          rejectTransfer.mutate({ id: tr.id, reason: String(reasons[tr.id]).trim() })
                        }
                      >
                        <X className="h-4 w-4" />
                        {t('branchDay.approvals.reject', 'Reject')}
                      </Button>
                    </div>
                  </PermissionGuard>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ApprovalsInboxPanel;
