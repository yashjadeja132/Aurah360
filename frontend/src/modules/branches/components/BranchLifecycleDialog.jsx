import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { BranchPicker } from '@/modules/appointments/components/bookingPickers';
import { useBranchMutations } from '@/modules/branches/hooks/useBranches';

/**
 * §1 branch deactivate/transfer — backend/src/services/BranchService.js#deactivate and
 * #transferToBranch commit in a single call (there is no separate dry-run endpoint); the
 * "impact summary shown before commit" requirement is met here with an explicit two-step
 * flow instead: step 1 collects the required inputs (reason, and for transfer, the destination
 * branch), step 2 is a plain-language warning of what the action will affect that the user must
 * confirm a second time before the actual API call fires. The real counts (activeAppointments,
 * activeStaff for deactivate; appointmentsMoved, doctorsReassigned for transfer) come back on
 * the response and are surfaced immediately after commit.
 */
export function BranchLifecycleDialog({ branch, mode, open, onOpenChange, onDone }) {
  const { t } = useTranslation();
  const { deactivate, transfer } = useBranchMutations();
  const [step, setStep] = useState('form');
  const [reason, setReason] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [result, setResult] = useState(null);

  const isTransfer = mode === 'transfer';
  const busy = deactivate.isPending || transfer.isPending;

  const reset = () => {
    setStep('form');
    setReason('');
    setToBranchId('');
    setResult(null);
  };

  const close = () => {
    reset();
    onOpenChange?.(false);
  };

  const canContinue = reason.trim().length >= 3 && (!isTransfer || Boolean(toBranchId));

  const commit = async () => {
    try {
      if (isTransfer) {
        const res = await transfer.mutateAsync({ id: branch.id, toBranchId });
        setResult(res?.data);
      } else {
        const res = await deactivate.mutateAsync({ id: branch.id, reason: reason.trim() });
        setResult(res?.data);
      }
      setStep('done');
      onDone?.();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          t('settings.branches.lifecycle.failed', 'Action failed')
      );
    }
  };

  const title = isTransfer
    ? t('settings.branches.lifecycle.transferTitle', 'Transfer branch')
    : t('settings.branches.lifecycle.deactivateTitle', 'Deactivate branch');

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {step === 'form' && (
            <DialogDescription>
              {isTransfer
                ? t(
                    'settings.branches.lifecycle.transferDescription',
                    'Move this branch’s active appointments and doctor privileges to another branch, then deactivate it.'
                  )
                : t(
                    'settings.branches.lifecycle.deactivateDescription',
                    'Deactivating takes this branch offline. Provide a reason for the audit trail.'
                  )}
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4">
            {isTransfer && (
              <div className="space-y-1.5">
                <Label>{t('settings.branches.lifecycle.destinationLabel', 'Destination branch')}</Label>
                <BranchPicker
                  value={toBranchId}
                  onChange={(id) => setToBranchId(id === branch.id ? '' : id)}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="lifecycleReason">
                {t('settings.branches.lifecycle.reasonLabel', 'Reason (minimum 3 characters)')}
              </Label>
              <Input
                id="lifecycleReason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t(
                  'settings.branches.lifecycle.reasonPlaceholder',
                  'Why is this branch being deactivated or transferred?'
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="button" disabled={!canContinue} onClick={() => setStep('confirm')}>
                {t('settings.branches.lifecycle.continue', 'Continue')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
              <p className="font-medium">
                {t('settings.branches.lifecycle.impactHeading', 'This will affect:')}
              </p>
              <ul className="mt-1 list-disc pl-5">
                <li>
                  {isTransfer
                    ? t(
                        'settings.branches.lifecycle.impactTransferAppointments',
                        'All upcoming/active appointments — reassigned to the destination branch'
                      )
                    : t(
                        'settings.branches.lifecycle.impactDeactivateAppointments',
                        'All upcoming/active appointments at this branch'
                      )}
                </li>
                <li>
                  {isTransfer
                    ? t(
                        'settings.branches.lifecycle.impactTransferStaff',
                        'Doctors assigned to this branch — reassigned to the destination branch'
                      )
                    : t('settings.branches.lifecycle.impactDeactivateStaff', 'Active staff currently assigned to this branch')}
                </li>
                {isTransfer && (
                  <li>{t('settings.branches.lifecycle.impactTransferOffline', 'This branch will be deactivated after the transfer')}</li>
                )}
              </ul>
              <p className="mt-2 text-xs">
                {t(
                  'settings.branches.lifecycle.impactNote',
                  'Exact counts will be shown once you confirm — this action is recorded in the audit log.'
                )}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStep('form')} disabled={busy}>
                {t('common.back', 'Back')}
              </Button>
              <Button type="button" variant="destructive" onClick={commit} disabled={busy}>
                {busy
                  ? t('settings.branches.lifecycle.confirming', 'Processing…')
                  : isTransfer
                    ? t('settings.branches.lifecycle.confirmTransfer', 'Confirm transfer')
                    : t('settings.branches.lifecycle.confirmDeactivate', 'Confirm deactivate')}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium">
                {t('settings.branches.lifecycle.resultHeading', 'Done — impact summary')}
              </p>
              {isTransfer ? (
                <ul className="mt-1 space-y-1">
                  <li>
                    {t('settings.branches.lifecycle.resultAppointmentsMoved', '{{count}} appointments moved', {
                      count: result?.appointmentsMoved ?? 0,
                    })}
                  </li>
                  <li>
                    {t('settings.branches.lifecycle.resultDoctorsReassigned', '{{count}} doctors reassigned', {
                      count: result?.doctorsReassigned ?? 0,
                    })}
                  </li>
                </ul>
              ) : (
                <ul className="mt-1 space-y-1">
                  <li>
                    {t(
                      'settings.branches.lifecycle.resultActiveAppointments',
                      '{{count}} upcoming appointments were affected',
                      { count: result?.impactSummary?.activeAppointments ?? 0 }
                    )}
                  </li>
                  <li>
                    {t(
                      'settings.branches.lifecycle.resultActiveStaff',
                      '{{count}} active staff were affected',
                      { count: result?.impactSummary?.activeStaff ?? 0 }
                    )}
                  </li>
                </ul>
              )}
            </div>
            <DialogFooter>
              <Button type="button" onClick={close}>
                {t('common.close', 'Close')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BranchLifecycleDialog;
