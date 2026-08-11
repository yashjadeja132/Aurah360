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
  useRefundApprovalQueue,
  useApproveRefund,
  useRejectRefund,
} from '@/modules/billing/hooks/useBilling';
import { formatMoney } from '@/modules/billing/constants';
import { invoiceDetailPath } from '@/constants/routes';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants/rbac';

const STATUS_FILTERS = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'];
// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES. A branch-scoped approver
// only ever has refunds from their own branch to see, so the cross-branch filter is
// Owner/Admin-only.
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];

/**
 * A.8 — the approver's refund queue. A refund above config.billing.refundApprovalThresholdAmount
 * is queued here (no money moves) until an approver decides; approving actually issues the
 * refund, rejecting leaves the payment untouched. Every decision requires a note (audited, mirrors
 * DiscountApprovalPanel / LoyaltyApprovalsPanel).
 */
export function RefundApprovalPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];

  const [status, setStatus] = useState('PENDING_APPROVAL');
  const [branchId, setBranchId] = useState('');
  const [notes, setNotes] = useState({});

  const params = { status, ...(branchId ? { branchId } : {}) };
  const { data, isLoading } = useRefundApprovalQueue(params);
  const rows = data?.items || [];
  const approve = useApproveRefund();
  const reject = useRejectRefund();

  const pending = status === 'PENDING_APPROVAL';
  const noteFor = (id) => (notes[id] || '').trim();
  const setNote = (id, value) => setNotes((n) => ({ ...n, [id]: value }));
  const decide = (mutation, id) =>
    mutation.mutate({ id, decisionNote: noteFor(id) }, { onSuccess: () => setNote(id, '') });

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>
          {t('billing.refundApprovals.queue', 'Queue')}{' '}
          <Badge variant={pending && rows.length ? 'destructive' : 'secondary'}>{rows.length}</Badge>
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {t(`billing.refundApprovals.status.${s}`, s)}
              </option>
            ))}
          </Select>
          {isGlobalScope && (
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-48">
              <option value="">{t('billing.refundApprovals.allBranches', 'All branches')}</option>
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
              <TableHead>{t('billing.refundApprovals.invoice', 'Invoice')}</TableHead>
              <TableHead>{t('billing.refundApprovals.patient', 'Patient')}</TableHead>
              <TableHead>{t('billing.refundApprovals.amount', 'Amount')}</TableHead>
              <TableHead>{t('billing.refundApprovals.reason', 'Reason')}</TableHead>
              <TableHead>{t('billing.refundApprovals.decision', 'Decision')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t('billing.refundApprovals.loading', 'Loading…')}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t('billing.refundApprovals.empty', 'Nothing here — no refunds in this state.')}
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link className="font-medium text-primary underline" to={invoiceDetailPath(r.invoiceId)}>
                    {r.invoiceNumber || r.invoiceId}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {t('billing.refundApprovals.requestedBy', 'Requested by')} {r.requestedByName || '—'}
                  </p>
                </TableCell>
                <TableCell>{r.patientName || '—'}</TableCell>
                <TableCell>
                  <span className="font-semibold text-destructive">{formatMoney(r.amount)}</span>
                  <p className="text-xs text-muted-foreground">
                    {t('billing.refundApprovals.thresholdNote', 'Threshold ₹{{threshold}}', {
                      threshold: r.thresholdAmount ?? 0,
                    })}
                  </p>
                </TableCell>
                <TableCell className="max-w-[16rem] text-sm">
                  {r.reason || <span className="text-muted-foreground">—</span>}
                  {r.notes && <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>}
                  {r.decisionNote && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('billing.refundApprovals.decidedNote', 'Decision')}: {r.decisionNote}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {pending ? (
                    <div className="space-y-2">
                      <Label className="text-xs">
                        {t('billing.refundApprovals.decisionNote', 'Decision note')}{' '}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        value={notes[r.id] || ''}
                        onChange={(e) => setNote(r.id, e.target.value)}
                        placeholder={t('billing.refundApprovals.decisionNotePlaceholder', 'Required — why?')}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={!noteFor(r.id) || approve.isPending}
                          onClick={() => decide(approve, r.id)}
                        >
                          <Check className="h-4 w-4" />
                          {t('billing.refundApprovals.approve', 'Approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!noteFor(r.id) || reject.isPending}
                          onClick={() => decide(reject, r.id)}
                        >
                          <X className="h-4 w-4" />
                          {t('billing.refundApprovals.reject', 'Reject')}
                        </Button>
                      </div>
                      {!noteFor(r.id) && (
                        <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {t('billing.refundApprovals.noteRequired', 'A note is required to decide.')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Badge variant={r.status === 'APPROVED' ? 'success' : 'destructive'}>{r.status}</Badge>
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

export default RefundApprovalPanel;
