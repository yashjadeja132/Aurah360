import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Building2,
  Clock,
  IndianRupee,
  Inbox,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { DiscountApprovalPanel } from '@/modules/billing/components/DiscountApprovalPanel';
import { formatMoney, PAYMENT_METHOD_OPTIONS } from '@/modules/billing/constants';
import { QueueLoadPanel } from '@/modules/branchManager/components/QueueLoadPanel';
import { StockAlertsPanel } from '@/modules/branchManager/components/StockAlertsPanel';
import { ApprovalsInboxPanel } from '@/modules/branchManager/components/ApprovalsInboxPanel';
import { useBranchDay } from '@/modules/branchManager/hooks/useBranchDay';

const METHOD_LABEL = Object.fromEntries(PAYMENT_METHOD_OPTIONS.map((m) => [m.value, m.label]));

/**
 * B1 — the Branch Manager command screen. The flow diff calls this "the single biggest structural
 * flow gap in Part B": no branch-manager dashboard existed at all, so the manager landed on the
 * generic tile page and had to open Reception, Reports, Inventory and Billing separately to
 * reconstruct one picture.
 *
 * This is that picture on one screen — queue load and waiting times across doctors, today's revenue
 * against the same weekday last week, low/expiring stock, and every approval waiting on them (with
 * the cash-close and stock-transfer decisions taken inline). Built entirely on existing endpoints;
 * see `useBranchDay` for the mapping and for why `/reports/dashboards/branch-manager` is not used.
 */
export default function BranchCommandPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // BRANCH_MANAGER holds `branches.view` and `doctors.view`, so both lists are safe to read here.
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];
  const sortedBranches = useMemo(
    () =>
      [...branches].sort((a, b) =>
        String(a.branchCode || '').localeCompare(String(b.branchCode || ''))
      ),
    [branches]
  );

  const [selectedBranchId, setSelectedBranchId] = useState('');
  const branchId = selectedBranchId || user?.branch || sortedBranches[0]?.id || '';

  const { data: doctorsData } = useDoctorList({ limit: 100 });
  const doctors = doctorsData?.items || [];

  const day = useBranchDay({ branchId });
  const discountsRef = useRef(null);

  const branchName =
    sortedBranches.find((b) => String(b.id) === String(branchId))?.displayName ||
    sortedBranches.find((b) => String(b.id) === String(branchId))?.name ||
    null;

  const revenue = day.revenue;
  const trendUp = revenue.delta >= 0;

  return (
    <section>
      <PageHeader
        icon={Building2}
        title={t('branchDay.title', 'Branch command')}
        description={t(
          'branchDay.subtitle',
          "Your branch on one screen — where the queue is stuck, what today has earned against last week, what stock is running out, and everything waiting on your approval."
        )}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={branchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-52"
            >
              <option value="">{t('branchDay.selectBranch', 'Select branch')}</option>
              {sortedBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName || b.name}
                </option>
              ))}
            </Select>
            <Button asChild variant="outline">
              <Link to={APP_ROUTES.REPORTS}>{t('branchDay.openReports', 'Reports')}</Link>
            </Button>
          </div>
        }
      />

      {day.isDisabled ? (
        <EmptyState
          icon={Building2}
          title={t('branchDay.noBranchTitle', 'Pick a branch')}
          description={t(
            'branchDay.noBranchDescription',
            'This screen is branch-scoped. Choose a branch to load its queue, revenue, stock and approvals.'
          )}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={IndianRupee}
              label={t('branchDay.stats.revenueToday', 'Revenue today')}
              value={revenue.isLoading ? '—' : formatMoney(revenue.total)}
              tone={trendUp ? 'success' : 'warning'}
              hint={
                revenue.deltaPercent === null
                  ? t('branchDay.stats.noBaseline', 'No collection on {{date}} to compare with', {
                      date: revenue.comparedTo,
                    })
                  : t('branchDay.stats.vsLastWeek', '{{sign}}{{percent}}% vs {{amount}} same day last week', {
                      sign: trendUp ? '+' : '',
                      percent: revenue.deltaPercent,
                      amount: formatMoney(revenue.lastWeekTotal),
                    })
              }
            />
            <StatCard
              icon={Clock}
              label={t('branchDay.stats.waiting', 'Waiting now')}
              value={String(day.queue.counts.waiting ?? 0)}
              tone={day.queue.bottleneck ? 'destructive' : 'default'}
              hint={t('branchDay.stats.waitingHint', 'Worst wait {{worst}} min · branch average {{avg}} min', {
                worst: day.queue.doctorLoad[0]?.longestWait ?? 0,
                avg: day.queue.averageWaitTime,
              })}
            />
            <StatCard
              icon={Boxes}
              label={t('branchDay.stats.stock', 'Stock alerts')}
              value={String(day.stock.lowStockCount + day.stock.expiringCount)}
              tone={day.stock.lowStockCount + day.stock.expiringCount ? 'warning' : 'default'}
              hint={t('branchDay.stats.stockHint', '{{low}} low · {{expiring}} expiring · {{expired}} expired', {
                low: day.stock.lowStockCount,
                expiring: day.stock.expiringCount,
                expired: day.stock.expiredCount,
              })}
            />
            <StatCard
              icon={Inbox}
              label={t('branchDay.stats.approvals', 'Awaiting you')}
              value={String(day.approvals.total)}
              tone={day.approvals.total ? 'destructive' : 'default'}
              hint={t('branchDay.stats.approvalsHint', 'Discounts, cash closes and stock transfers')}
            />
          </div>

          <ApprovalsInboxPanel
            approvals={day.approvals}
            onJumpToDiscounts={() =>
              discountsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          />

          <div className="grid gap-6 xl:grid-cols-2">
            <QueueLoadPanel queue={day.queue} doctors={doctors} />
            <StockAlertsPanel stock={day.stock} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {t('branchDay.revenue.title', "Today's collection by mode")}
                {revenue.deltaPercent !== null && (
                  <Badge variant={trendUp ? 'success' : 'destructive'}>
                    {trendUp ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    )}
                    {t('branchDay.revenue.delta', '{{amount}} vs last week', {
                      amount: formatMoney(Math.abs(revenue.delta)),
                    })}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {revenue.isLoading && <Skeleton className="h-8 w-full" />}
              {!revenue.isLoading && revenue.count === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('branchDay.revenue.empty', 'No payment has been recorded at {{branch}} today yet.', {
                    branch: branchName || t('branchDay.revenue.thisBranch', 'this branch'),
                  })}
                </p>
              )}
              {!revenue.isLoading && revenue.count > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(revenue.byMode)
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

          <PermissionGuard
            permissions={[PERMISSIONS.BILLING_DISCOUNT_APPROVE, PERMISSIONS.BILLING_ALL]}
          >
            <div ref={discountsRef}>
              <h2 className="mb-3 font-display text-xl font-semibold">
                {t('branchDay.discounts.heading', 'Discount approvals')}
              </h2>
              <DiscountApprovalPanel />
            </div>
          </PermissionGuard>
        </div>
      )}
    </section>
  );
}
