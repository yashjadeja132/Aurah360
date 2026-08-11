import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckCircle2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PaymentDialog } from '@/modules/billing/components/PaymentDialog';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useDuePayments, useRecordPayment } from '@/modules/billing/hooks/useBilling';
import { AGING_BUCKET_OPTIONS, formatMoney } from '@/modules/billing/constants';
import { invoiceDetailPath } from '@/constants/routes';
import { PERMISSIONS, ROLES } from '@/constants/rbac';
import { useAuth } from '@/contexts/AuthContext';

// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES. A branch-scoped cashier only
// ever has due invoices from their own branch to collect against, so the cross-branch filter is
// Owner/Admin-only.
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];

/** Older money is riskier money — colour the bucket badge accordingly. */
export const BUCKET_VARIANT = {
  CURRENT: 'secondary',
  DAYS_8_30: 'info',
  DAYS_31_60: 'warning',
  DAYS_60_PLUS: 'destructive',
};

/**
 * A.4 — the cashier's due-collection worklist. Every finalized invoice still carrying a balance,
 * OLDEST FIRST (age drives collection priority, unlike the newest-first invoice browse list),
 * with aging buckets and a "Collect due" action that opens the same PaymentDialog the invoice
 * detail page uses, pre-filled with the outstanding balance.
 *
 * Extracted from the former `DuePaymentsPage` body so the billing hub can render it as a tab.
 * `initialCheckedInToday` lets a caller (the cashier landing) open straight onto the at-the-desk
 * subset; everything else behaves exactly as the standalone screen did.
 */
export function DuePaymentsPanel({ initialCheckedInToday = false, showBuckets = true }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];

  const [branchId, setBranchId] = useState('');
  const [bucket, setBucket] = useState('');
  const [search, setSearch] = useState('');
  const [checkedInToday, setCheckedInToday] = useState(initialCheckedInToday);
  // Which invoice we are collecting against (null = dialog closed).
  const [collectTarget, setCollectTarget] = useState(null);

  const params = {
    ...(branchId ? { branchId } : {}),
    ...(bucket ? { bucket } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(checkedInToday ? { checkedInToday: 'true' } : {}),
  };
  const { data, isLoading } = useDuePayments(params);
  const rows = data?.items || [];
  const meta = data?.meta || {};
  const buckets = meta.buckets || {};

  // The mutation is keyed to the invoice being collected so its detail cache is refreshed too.
  const recordPayment = useRecordPayment(collectTarget?.id);

  return (
    <div className="space-y-6">
      {showBuckets && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                {t('billing.duePayments.totalOutstanding', 'Total outstanding')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-destructive">
                {formatMoney(meta.totalOutstanding)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('billing.duePayments.invoiceCount', '{{count}} invoice(s)', { count: meta.total || 0 })}
              </p>
            </CardContent>
          </Card>
          {AGING_BUCKET_OPTIONS.map((b) => (
            <Card key={b.value}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">
                  {t(`billing.duePayments.bucket.${b.value}`, b.label)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-semibold">{formatMoney(buckets[b.value]?.outstanding)}</p>
                <p className="text-xs text-muted-foreground">
                  {t('billing.duePayments.invoiceCount', '{{count}} invoice(s)', {
                    count: buckets[b.value]?.count || 0,
                  })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>
            {t('billing.duePayments.worklist', 'Worklist')} <Badge variant="secondary">{rows.length}</Badge>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              className="w-44"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('billing.duePayments.searchPlaceholder', 'Invoice number')}
            />
            {isGlobalScope && (
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-44">
                <option value="">{t('billing.duePayments.allBranches', 'All branches')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.displayName || b.name}
                  </option>
                ))}
              </Select>
            )}
            <Select value={bucket} onChange={(e) => setBucket(e.target.value)} className="w-44">
              <option value="">{t('billing.duePayments.allAges', 'All ages')}</option>
              {AGING_BUCKET_OPTIONS.map((b) => (
                <option key={b.value} value={b.value}>
                  {t(`billing.duePayments.bucket.${b.value}`, b.label)}
                </option>
              ))}
            </Select>
            <Button
              variant={checkedInToday ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCheckedInToday((v) => !v)}
            >
              <CheckCircle2 className="h-4 w-4" />
              {t('billing.duePayments.checkedInToday', 'Checked in today')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {!isLoading && rows.length === 0 && (
            <EmptyState
              icon={Wallet}
              title={t('billing.duePayments.emptyTitle', 'Nothing to collect')}
              description={
                checkedInToday
                  ? t(
                      'billing.duePayments.emptyCheckedIn',
                      'No patient checked in today has an outstanding balance.'
                    )
                  : t('billing.duePayments.empty', 'No finalized invoice has an outstanding balance.')
              }
            />
          )}

          {!isLoading && rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('billing.duePayments.invoice', 'Invoice')}</TableHead>
                  <TableHead>{t('billing.duePayments.patient', 'Patient')}</TableHead>
                  <TableHead>{t('billing.duePayments.age', 'Age')}</TableHead>
                  <TableHead>{t('billing.duePayments.total', 'Total')}</TableHead>
                  <TableHead>{t('billing.duePayments.paid', 'Paid')}</TableHead>
                  <TableHead>{t('billing.duePayments.balance', 'Balance')}</TableHead>
                  <TableHead>{t('billing.duePayments.action', 'Action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      <Link className="font-medium text-primary underline" to={invoiceDetailPath(inv.id)}>
                        {inv.invoiceNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'} ·{' '}
                        {inv.branch?.name || '—'}
                      </p>
                    </TableCell>
                    <TableCell>
                      {inv.patient?.fullName || '—'}
                      <p className="text-xs text-muted-foreground">{inv.patient?.mobile || ''}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={BUCKET_VARIANT[inv.agingBucket] || 'secondary'}>
                        {t('billing.duePayments.days', '{{count}}d', { count: inv.ageDays || 0 })}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatMoney(inv.total)}</TableCell>
                    <TableCell>{formatMoney(inv.paidAmount)}</TableCell>
                    <TableCell className="font-semibold text-destructive">
                      {formatMoney(inv.balanceAmount)}
                    </TableCell>
                    <TableCell>
                      <PermissionGuard permissions={[PERMISSIONS.BILLING_PAYMENT, PERMISSIONS.BILLING_ALL]}>
                        <Button size="sm" onClick={() => setCollectTarget(inv)}>
                          {t('billing.duePayments.collect', 'Collect due')}
                        </Button>
                      </PermissionGuard>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Keyed by invoice id so the dialog remounts (and re-derives its pre-filled amount) per row. */}
      <PaymentDialog
        key={collectTarget?.id || 'none'}
        open={Boolean(collectTarget)}
        balance={collectTarget?.balanceAmount || 0}
        pending={recordPayment.isPending}
        onClose={() => setCollectTarget(null)}
        onSubmit={(payload) =>
          recordPayment.mutate(payload, { onSuccess: () => setCollectTarget(null) })
        }
      />
    </div>
  );
}

export default DuePaymentsPanel;
