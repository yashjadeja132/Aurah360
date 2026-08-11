import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import {
  useAdjustmentRequests,
  useApproveAdjustmentRequest,
  useRejectAdjustmentRequest,
} from '@/modules/inventory/hooks/useInventory';
import { PERMISSIONS } from '@/constants/rbac';

const STATUS_VARIANT = {
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'destructive',
};

/**
 * INV-003 — the approval side of "unusual adjustment needs approval" (Manager/Pharmacy flow
 * docs). Mirrors InventoryTransfersPanel's request/decide structure: a request list, with
 * Approve/Reject actions gated on INVENTORY_ADJUST_APPROVE. Routine (below-threshold)
 * adjustments never appear here — they wrote to stock immediately from the Adjust form and have
 * no request row at all.
 */
export function StockAdjustmentApprovalPanel() {
  const { t } = useTranslation();
  const { data: requests = [], isLoading } = useAdjustmentRequests();
  const approve = useApproveAdjustmentRequest();
  const reject = useRejectAdjustmentRequest();

  const pending = requests.filter((r) => r.status === 'PENDING_APPROVAL');
  const decided = requests.filter((r) => r.status !== 'PENDING_APPROVAL');

  const onReject = (row) => {
    const reason = window.prompt(
      t('inventory.adjustments.rejectReasonPrompt', 'Reason for rejecting this adjustment (optional):')
    );
    if (reason === null) return;
    reject.mutate({ id: row.id, reason });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t(
          'inventory.adjustments.subtitle',
          'Adjustments above the unit/value threshold queue here instead of writing to stock immediately. Verify the reason, then Approve to post the immutable ledger entry.'
        )}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>{t('inventory.adjustments.pending', 'Pending approval')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!isLoading && pending.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={t('inventory.adjustments.empty', 'Nothing waiting.')}
              description={t(
                'inventory.adjustments.emptyHint',
                'Every unusual adjustment has been decided.'
              )}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('inventory.adjustments.number', 'Adjustment #')}</TableHead>
                  <TableHead>{t('inventory.adjustments.quantity', 'Quantity')}</TableHead>
                  <TableHead>{t('inventory.adjustments.reason', 'Reason')}</TableHead>
                  <TableHead>{t('inventory.adjustments.category', 'Category')}</TableHead>
                  <TableHead>{t('inventory.adjustments.actions', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.adjustmentNumber}</TableCell>
                    <TableCell className={row.quantityDelta < 0 ? 'text-destructive' : 'text-success'}>
                      {row.quantityDelta > 0 ? '+' : ''}
                      {row.quantityDelta}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{row.reason}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.reasonCategory}</Badge>
                    </TableCell>
                    <TableCell className="space-x-1">
                      <PermissionGuard
                        permissions={[PERMISSIONS.INVENTORY_ADJUST_APPROVE, PERMISSIONS.INVENTORY_ALL]}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={approve.isPending}
                          onClick={() => approve.mutate(row.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />{' '}
                          {t('inventory.adjustments.approve', 'Approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={reject.isPending}
                          onClick={() => onReject(row)}
                        >
                          <XCircle className="h-3.5 w-3.5" /> {t('inventory.adjustments.reject', 'Reject')}
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

      <Card>
        <CardHeader>
          <CardTitle>{t('inventory.adjustments.history', 'Decided')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('inventory.adjustments.number', 'Adjustment #')}</TableHead>
                <TableHead>{t('inventory.adjustments.quantity', 'Quantity')}</TableHead>
                <TableHead>{t('inventory.adjustments.reason', 'Reason')}</TableHead>
                <TableHead>{t('inventory.adjustments.status', 'Status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && decided.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {t('inventory.adjustments.noHistory', 'No decided adjustments yet.')}
                  </TableCell>
                </TableRow>
              )}
              {decided.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.adjustmentNumber}</TableCell>
                  <TableCell>{row.quantityDelta}</TableCell>
                  <TableCell className="max-w-xs truncate">{row.reason}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status] || 'secondary'}>{row.status}</Badge>
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

export default StockAdjustmentApprovalPanel;
