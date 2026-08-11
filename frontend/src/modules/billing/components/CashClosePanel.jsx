import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useCashCloses, useSubmitCashClose, useApproveCashClose } from '@/modules/billing/hooks/useBillingOps';
import { PERMISSIONS, ROLES } from '@/constants/rbac';
import { useAuth } from '@/contexts/AuthContext';

// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES.
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];
// 'Today' must come from the LOCAL calendar day: a UTC slice returns YESTERDAY between 00:00
// and 05:30 IST, so a view opened before dawn silently loaded the wrong day. See '@/utils/date'.
import { todayKey } from '@/utils/date';

const emptyForm = {
  branchId: '',
  closeDate: todayKey(),
  openingCash: '',
  cashCollected: '',
  cashRefunded: '0',
  otherModeCollected: '0',
  countedCash: '',
  varianceReason: '',
  notes: '',
};

/**
 * BIL-003 — daily branch cash close: opening, collected, refunded, expected vs counted, variance.
 * Extracted from the former `CashClosePage` body so the billing hub can render it as a tab.
 */
export function CashClosePanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // A branch-scoped role (everyone except Owner/Admin) already works at exactly one branch —
  // the picker below is only meaningful for Owner/Admin, who legitimately close cash across
  // branches. Everyone else gets it pre-filled and locked to their own branch.
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const ownBranchId = !isGlobalScope ? user?.branch || '' : '';
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];
  const [form, setForm] = useState(() => ({ ...emptyForm, branchId: ownBranchId }));
  const [branchFilter, setBranchFilter] = useState(ownBranchId);

  useEffect(() => {
    if (ownBranchId) {
      setForm((f) => (f.branchId ? f : { ...f, branchId: ownBranchId }));
      setBranchFilter((v) => v || ownBranchId);
    }
  }, [ownBranchId]);

  const { data: closes = [], isLoading } = useCashCloses(branchFilter ? { branchId: branchFilter } : {});
  const submit = useSubmitCashClose();
  const approve = useApproveCashClose();

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const expected =
    (Number(form.openingCash) || 0) + (Number(form.cashCollected) || 0) - (Number(form.cashRefunded) || 0);
  const variance = (Number(form.countedCash) || 0) - expected;
  // CC-06 — any non-zero variance must carry a reason before the close can be submitted.
  const varianceReasonMissing = variance !== 0 && !form.varianceReason.trim();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.branchId || varianceReasonMissing) return;
    await submit.mutateAsync({
      ...form,
      openingCash: Number(form.openingCash) || 0,
      cashCollected: Number(form.cashCollected) || 0,
      cashRefunded: Number(form.cashRefunded) || 0,
      otherModeCollected: Number(form.otherModeCollected) || 0,
      countedCash: Number(form.countedCash) || 0,
    });
    setForm({ ...emptyForm, branchId: form.branchId });
  };

  return (
    <div className="space-y-6">
      <PermissionGuard permissions={[PERMISSIONS.BILLING_CASH_CLOSE, PERMISSIONS.BILLING_ALL]}>
        <Card>
          <CardHeader>
            <CardTitle>{t('billing.cashClose.submitToday', "Submit today's close")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('billing.cashClose.branch', 'Branch')}</Label>
                {isGlobalScope ? (
                  <Select value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}>
                    <option value="">{t('billing.cashClose.selectBranch', 'Select branch')}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={branches.find((b) => b.id === ownBranchId)?.displayName || branches.find((b) => b.id === ownBranchId)?.name || ''}
                    disabled
                    readOnly
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>{t('billing.cashClose.closeDate', 'Close date')}</Label>
                <Input type="date" value={form.closeDate} onChange={set('closeDate')} />
              </div>
              <div className="space-y-2">
                <Label>{t('billing.cashClose.openingCash', 'Opening cash (₹)')}</Label>
                <Input type="number" value={form.openingCash} onChange={set('openingCash')} />
              </div>
              <div className="space-y-2">
                <Label>{t('billing.cashClose.cashCollected', 'Cash collected (₹)')}</Label>
                <Input type="number" value={form.cashCollected} onChange={set('cashCollected')} />
              </div>
              <div className="space-y-2">
                <Label>{t('billing.cashClose.cashRefunded', 'Cash refunded (₹)')}</Label>
                <Input type="number" value={form.cashRefunded} onChange={set('cashRefunded')} />
              </div>
              <div className="space-y-2">
                <Label>{t('billing.cashClose.otherModeCollected', 'Other-mode collected (₹)')}</Label>
                <Input type="number" value={form.otherModeCollected} onChange={set('otherModeCollected')} />
              </div>
              <div className="space-y-2">
                <Label>{t('billing.cashClose.countedCash', 'Counted cash (₹)')}</Label>
                <Input type="number" value={form.countedCash} onChange={set('countedCash')} />
              </div>
              <div className="flex flex-col justify-center rounded-lg border bg-muted/40 px-4 py-2 text-sm">
                <span className="text-muted-foreground">{t('billing.cashClose.expected', 'Expected')}: ₹{expected.toFixed(2)}</span>
                <span className={variance === 0 ? 'text-success font-semibold' : 'text-warning font-semibold'}>
                  {t('billing.cashClose.variance', 'Variance')}: ₹{variance.toFixed(2)}
                </span>
              </div>
              {variance !== 0 && (
                <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                  <Label>
                    {t('billing.cashClose.varianceReason', 'Variance reason')} <span className="text-destructive">*</span>
                  </Label>
                  <Input value={form.varianceReason} onChange={set('varianceReason')} placeholder={t('billing.cashClose.varianceReasonPlaceholder', 'Required if variance ≠ 0')} />
                  {varianceReasonMissing && (
                    <p className="text-xs font-medium text-destructive">
                      {t('billing.cashClose.varianceReasonRequired', 'A reason is required whenever the variance is not zero.')}
                    </p>
                  )}
                </div>
              )}
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={submit.isPending || !form.branchId || varianceReasonMissing}>
                  {t('billing.cashClose.submitClose', 'Submit close')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </PermissionGuard>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('billing.cashClose.history', 'History')}</CardTitle>
          {isGlobalScope && (
            <Select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="w-48">
              <option value="">{t('billing.cashClose.allBranches', 'All branches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
              ))}
            </Select>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('billing.cashClose.date', 'Date')}</TableHead>
                <TableHead>{t('billing.cashClose.expected', 'Expected')}</TableHead>
                <TableHead>{t('billing.cashClose.counted', 'Counted')}</TableHead>
                <TableHead>{t('billing.cashClose.variance', 'Variance')}</TableHead>
                <TableHead>{t('billing.cashClose.status', 'Status')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && closes.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t('billing.cashClose.noRecords', 'No cash close records yet.')}</TableCell></TableRow>
              )}
              {closes.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{new Date(c.closeDate).toDateString()}</TableCell>
                  <TableCell>₹{c.expectedCash}</TableCell>
                  <TableCell>₹{c.countedCash}</TableCell>
                  <TableCell className={c.variance !== 0 ? 'text-warning font-semibold' : ''}>₹{c.variance}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === 'APPROVED' ? 'success' : (c.status === 'DISPUTED' || c.status === 'PENDING_OWNER_APPROVAL') ? 'warning' : 'secondary'}>
                      {c.status === 'APPROVED' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                      {(c.status === 'DISPUTED' || c.status === 'PENDING_OWNER_APPROVAL') && <AlertTriangle className="mr-1 h-3 w-3" />}
                      {c.status === 'PENDING_OWNER_APPROVAL'
                        ? t('billing.cashClose.pendingOwnerApproval', 'Needs Owner approval')
                        : c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {/* A large-variance close is gated to OWNER server-side (CashCloseService#approve) —
                        a branch manager holding the generic approve permission would otherwise see a
                        button that always 403s, so it's hidden for them specifically on this status. */}
                    {c.status !== 'APPROVED' && (c.status !== 'PENDING_OWNER_APPROVAL' || user?.role === ROLES.OWNER) && (
                      <PermissionGuard permissions={[PERMISSIONS.BILLING_CASH_CLOSE_APPROVE, PERMISSIONS.BILLING_ALL]}>
                        <Button size="sm" variant="outline" onClick={() => approve.mutate(c.id)} disabled={approve.isPending}>
                          {t('billing.cashClose.approve', 'Approve')}
                        </Button>
                      </PermissionGuard>
                    )}
                    {c.status === 'PENDING_OWNER_APPROVAL' && user?.role !== ROLES.OWNER && (
                      <span className="text-xs text-muted-foreground">
                        {t('billing.cashClose.escalatedToOwner', 'Escalated to Owner')}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default CashClosePanel;
