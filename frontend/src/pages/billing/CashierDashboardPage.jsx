import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { BadgePercent, IndianRupee, ReceiptText, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { AwaitingBillingPanel } from '@/modules/billing/components/AwaitingBillingPanel';
import { DuePaymentsPanel } from '@/modules/billing/components/DuePaymentsPanel';
import { DiscountApprovalPanel } from '@/modules/billing/components/DiscountApprovalPanel';
import { useCashierDay } from '@/modules/billing/hooks/useCashierDay';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { formatMoney, PAYMENT_METHOD_OPTIONS } from '@/modules/billing/constants';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS, ROLES } from '@/constants/rbac';
import { useAuth } from '@/contexts/AuthContext';

// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES. The Cashier landing page is
// used by the branch-scoped Cashier role — their own branch is fixed context, not a picker.
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];

const METHOD_LABEL = Object.fromEntries(PAYMENT_METHOD_OPTIONS.map((m) => [m.value, m.label]));

/**
 * A.1 — the cashier's landing screen: their actual worklist, not a generic dashboard. It answers
 * four questions without navigating anywhere — who is waiting to be billed, what is outstanding
 * (with Collect right here), what is stuck on a discount approval, and how much has come in today.
 *
 * Every figure comes from an endpoint that already exists; see `useCashierDay` for the mapping.
 */
export default function CashierDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];
  const [branchId, setBranchId] = useState('');
  const effectiveBranch = !isGlobalScope ? user?.branch || '' : branchId;

  const { awaitingBilling, dues, duesAtDesk, approvals, collection } = useCashierDay({
    branchId: effectiveBranch || undefined,
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('billing.cashier.title', 'Cash desk')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'billing.cashier.subtitle',
              "Everything waiting on you right now — bills to finish, money to collect, approvals to chase, and today's total."
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isGlobalScope && (
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-48">
              <option value="">{t('billing.cashier.allBranches', 'All branches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName || b.name}
                </option>
              ))}
            </Select>
          )}
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.BILLING}>{t('billing.cashier.openBilling', 'Open billing')}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={IndianRupee}
          label={t('billing.cashier.collectedToday', 'Collected today')}
          value={formatMoney(collection.total)}
          hint={t('billing.cashier.paymentCount', '{{count}} payment(s)', { count: collection.count })}
          isLoading={collection.isLoading}
          tone="text-success"
        />
        <Tile
          icon={ReceiptText}
          label={t('billing.cashier.awaitingBilling', 'Awaiting billing')}
          value={String(awaitingBilling.total)}
          hint={t('billing.cashier.draftHint', 'Draft bills not yet finalized')}
          isLoading={awaitingBilling.isLoading}
        />
        <Tile
          icon={Wallet}
          label={t('billing.cashier.outstanding', 'Outstanding dues')}
          value={formatMoney(dues.totalOutstanding)}
          hint={t('billing.cashier.atDeskHint', '{{count}} at the desk today · {{amount}}', {
            count: duesAtDesk.count,
            amount: formatMoney(duesAtDesk.outstanding),
          })}
          isLoading={dues.isLoading}
          tone="text-destructive"
        />
        <PermissionGuard
          permissions={[PERMISSIONS.BILLING_DISCOUNT_APPROVE, PERMISSIONS.BILLING_ALL]}
          fallback={
            <Tile
              icon={BadgePercent}
              label={t('billing.cashier.refundedToday', 'Refunded today')}
              value={formatMoney(collection.refunded)}
              hint={t('billing.cashier.refundedHint', 'Excluded from the collected total')}
              isLoading={collection.isLoading}
            />
          }
        >
          <Tile
            icon={BadgePercent}
            label={t('billing.cashier.pendingApprovals', 'Awaiting discount approval')}
            value={String(approvals.count)}
            hint={t('billing.cashier.approvalHint', 'These bills cannot be finalized yet')}
            isLoading={approvals.isLoading}
            tone={approvals.count ? 'text-warning' : undefined}
          />
        </PermissionGuard>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            {t('billing.cashier.byMode', "Today's collection by mode")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {collection.isLoading && <Skeleton className="h-8 w-full" />}
          {!collection.isLoading && collection.count === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('billing.cashier.noPaymentsToday', 'No payment has been recorded today yet.')}
            </p>
          )}
          {!collection.isLoading && collection.count > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(collection.byMode)
                .sort((a, b) => b[1] - a[1])
                .map(([method, amount]) => (
                  <Badge key={method} variant="outline" className="text-sm">
                    {METHOD_LABEL[method] || method}: {formatMoney(amount)}
                  </Badge>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AwaitingBillingPanel
        items={awaitingBilling.items}
        total={awaitingBilling.total}
        isLoading={awaitingBilling.isLoading}
      />

      {/*
        The dues worklist opens on the "checked in today" subset — the highest-yield collection
        list, because the patient is physically at the desk. The cashier can clear the filter in
        place to see the whole aged book. Collect is the same guarded action as the dues screen.
      */}
      <div>
        <h2 className="mb-3 font-display text-xl font-semibold">
          {t('billing.cashier.collectNow', 'Collect now')}
        </h2>
        <DuePaymentsPanel initialCheckedInToday showBuckets={false} />
      </div>

      <PermissionGuard permissions={[PERMISSIONS.BILLING_DISCOUNT_APPROVE, PERMISSIONS.BILLING_ALL]}>
        <div>
          <h2 className="mb-3 font-display text-xl font-semibold">
            {t('billing.cashier.approvalsHeading', 'Discount approvals')}
          </h2>
          <DiscountApprovalPanel />
        </div>
      </PermissionGuard>
    </section>
  );
}

function Tile({ icon: Icon, label, value, hint, isLoading, tone }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="h-4 w-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className={`text-2xl font-semibold ${tone || ''}`}>{value}</p>
        )}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
