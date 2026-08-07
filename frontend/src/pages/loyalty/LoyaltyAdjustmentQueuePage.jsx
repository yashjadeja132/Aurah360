import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import {
  useAdjustmentQueue,
  useApproveAdjustment,
  useRejectAdjustment,
} from '@/modules/loyalty/hooks/useLoyalty';

const REASON_CATEGORIES = ['SERVICE_RECOVERY', 'CORRECTION', 'PROMOTION', 'OTHER'];

export default function LoyaltyAdjustmentQueuePage() {
  const { t } = useTranslation();
  const { data, isLoading } = useAdjustmentQueue({ status: 'PENDING_APPROVAL' });
  const approve = useApproveAdjustment();
  const reject = useRejectAdjustment();
  const [action, setAction] = useState(null); // { type: 'approve'|'reject', item }
  const [reason, setReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState('CORRECTION');
  const items = data?.items || [];

  const openAction = (type, item) => {
    setAction({ type, item });
    setReason('');
    setReasonCategory('CORRECTION');
  };

  const submitAction = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    if (action.type === 'approve') {
      await approve.mutateAsync({ id: action.item.id, note: reason, reasonCategory });
    } else {
      await reject.mutateAsync({ id: action.item.id, note: reason, reasonCategory });
    }
    setAction(null);
  };

  return (
    <PermissionGuard permissions={[PERMISSIONS.LOYALTY_ADJUST_APPROVE, PERMISSIONS.LOYALTY_ALL]} fallback="redirect">
      <section className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('loyalty.adjustments.title', 'Manual adjustment approval queue')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'loyalty.adjustments.subtitle',
              'Manual credits/debits above a staff member\'s own limit, awaiting approval'
            )}
          </p>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>}

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {item.patient?.fullName || item.patientId} · {item.points} {t('loyalty.adjustments.points', 'points')}
                  {' '}
                  <Badge variant={item.entryType === 'MANUAL_DEBIT' ? 'destructive' : 'success'}>
                    {t(`loyalty.entryType.${item.entryType}`, item.entryType)}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(`loyalty.manualReasonCategory.${item.reasonCategory}`, item.reasonCategory)} · {item.note}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('loyalty.adjustments.requestedBy', 'Requested by')}: {item.createdBy?.fullName || item.createdBy}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => openAction('approve', item)}>
                  {t('loyalty.adjustments.approve', 'Approve')}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => openAction('reject', item)}>
                  {t('loyalty.adjustments.reject', 'Reject')}
                </Button>
              </div>
            </div>
          ))}
          {!items.length && !isLoading && (
            <p className="text-sm text-muted-foreground">{t('loyalty.adjustments.empty', 'No pending adjustments.')}</p>
          )}
        </div>

        <Dialog open={Boolean(action)} onOpenChange={(v) => !v && setAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {action?.type === 'approve'
                  ? t('loyalty.adjustments.approveTitle', 'Approve adjustment')
                  : t('loyalty.adjustments.rejectTitle', 'Reject adjustment')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={submitAction} className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('loyalty.adjustments.fields.reasonCategory', 'Reason category')}</Label>
                <Select value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)}>
                  {REASON_CATEGORIES.map((v) => (
                    <option key={v} value={v}>
                      {t(`loyalty.manualReasonCategory.${v}`, v)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="approvalNote">{t('loyalty.adjustments.fields.note', 'Note (mandatory)')}</Label>
                <Input
                  id="approvalNote"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder={t('loyalty.adjustments.notePlaceholder', 'Explain why this decision was made')}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAction(null)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button type="submit" disabled={!reason.trim() || approve.isPending || reject.isPending}>
                  {t('common.confirm', 'Confirm')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>
    </PermissionGuard>
  );
}
