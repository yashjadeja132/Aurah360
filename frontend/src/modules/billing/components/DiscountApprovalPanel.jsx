import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import {
  useDiscountApprovalQueue,
  useApproveDiscount,
  useRejectDiscount,
} from '@/modules/billing/hooks/useBilling';
import { formatMoney } from '@/modules/billing/constants';
import { invoiceDetailPath } from '@/constants/routes';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants/rbac';

const STATUS_FILTERS = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'];
// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES. A branch-scoped approver
// (e.g. Branch Manager) only ever has decisions from their own branch to see, so the
// cross-branch filter below is Owner/Admin-only.
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];

/**
 * A.5 — the approver's queue. A draft invoice whose staff-granted discount exceeds the
 * configured threshold cannot be finalized until it is decided here, and every decision needs a
 * note (it lands on the invoice timeline and in the audit trail).
 *
 * Extracted from the former `DiscountApprovalQueuePage` body so the billing hub can render it as a
 * tab. Callers are responsible for the `billing.discount_approve` gate, exactly as the route was.
 */
export function DiscountApprovalPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];

  const [status, setStatus] = useState('PENDING_APPROVAL');
  const [branchId, setBranchId] = useState('');
  // Per-row decision note, keyed by invoice id — each decision carries its own justification.
  const [notes, setNotes] = useState({});

  const params = { status, ...(branchId ? { branchId } : {}) };
  const { data, isLoading } = useDiscountApprovalQueue(params);
  const rows = data?.items || [];
  const approve = useApproveDiscount();
  const reject = useRejectDiscount();

  const pending = status === 'PENDING_APPROVAL';
  const noteFor = (id) => (notes[id] || '').trim();
  const setNote = (id, value) => setNotes((n) => ({ ...n, [id]: value }));
  const decide = (mutation, id) =>
    mutation.mutate({ id, decisionNote: noteFor(id) }, { onSuccess: () => setNote(id, '') });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>
          {t('billing.discountApprovals.queue', 'Queue')}{' '}
          <Badge variant={pending && rows.length ? 'destructive' : 'secondary'}>{rows.length}</Badge>
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {t(`billing.discountApprovals.status.${s}`, s)}
              </option>
            ))}
          </Select>
          {isGlobalScope && (
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-48">
              <option value="">{t('billing.discountApprovals.allBranches', 'All branches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.displayName || b.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('billing.discountApprovals.invoice', 'Invoice')}</TableHead>
              <TableHead>{t('billing.discountApprovals.patient', 'Patient')}</TableHead>
              <TableHead>{t('billing.discountApprovals.subtotal', 'Subtotal')}</TableHead>
              <TableHead>{t('billing.discountApprovals.discount', 'Discount')}</TableHead>
              <TableHead>{t('billing.discountApprovals.reason', 'Reason given')}</TableHead>
              <TableHead>{t('billing.discountApprovals.decision', 'Decision')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t('billing.discountApprovals.loading', 'Loading…')}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t('billing.discountApprovals.empty', 'Nothing here — no discounts in this state.')}
                </TableCell>
              </TableRow>
            )}
            {rows.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>
                  <Link className="font-medium text-primary underline" to={invoiceDetailPath(inv.id)}>
                    {inv.invoiceNumber}
                  </Link>
                  <p className="text-xs text-muted-foreground">{inv.branch?.name || '—'}</p>
                </TableCell>
                <TableCell>{inv.patient?.fullName || '—'}</TableCell>
                <TableCell>{formatMoney(inv.subtotal)}</TableCell>
                <TableCell>
                  <span className="font-semibold text-destructive">{formatMoney(inv.discount)}</span>
                  <p className="text-xs text-muted-foreground">
                    {t('billing.discountApprovals.percentOfSubtotal', '{{percent}}% (threshold {{threshold}}%)', {
                      percent: inv.discountPercent ?? 0,
                      threshold: inv.thresholdPercent ?? 0,
                    })}
                  </p>
                </TableCell>
                <TableCell className="max-w-[16rem] text-sm">
                  {inv.discountReason || <span className="text-muted-foreground">—</span>}
                  {inv.discountDecisionNote && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('billing.discountApprovals.decidedNote', 'Decision')}: {inv.discountDecisionNote}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {pending ? (
                    <div className="space-y-2">
                      <Label className="text-xs">
                        {t('billing.discountApprovals.decisionNote', 'Decision note')}{' '}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={notes[inv.id] || ''}
                        onChange={(e) => setNote(inv.id, e.target.value)}
                        placeholder={t('billing.discountApprovals.decisionNotePlaceholder', 'Required — why?')}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={!noteFor(inv.id) || approve.isPending}
                          onClick={() => decide(approve, inv.id)}
                        >
                          <Check className="h-4 w-4" />
                          {t('billing.discountApprovals.approve', 'Approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!noteFor(inv.id) || reject.isPending}
                          onClick={() => decide(reject, inv.id)}
                        >
                          <X className="h-4 w-4" />
                          {t('billing.discountApprovals.reject', 'Reject')}
                        </Button>
                      </div>
                      {!noteFor(inv.id) && (
                        <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {t('billing.discountApprovals.noteRequired', 'A note is required to decide.')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Badge variant={inv.discountApprovalStatus === 'APPROVED' ? 'success' : 'destructive'}>
                      {inv.discountApprovalStatus}
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default DiscountApprovalPanel;
