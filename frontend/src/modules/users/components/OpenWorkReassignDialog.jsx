import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

/**
 * §Admin offboarding — "queues/tasks reassigned" (aurah_flow_admin.md). Mirrors
 * RosterImpactPanel's UX pattern (list what's impacted, require an explicit choice, then
 * commit) but for a deactivated/deleted staff member's open recall/CRM follow-up work instead
 * of appointments — surfaced when the backend returns 409 OPEN_WORK_REASSIGNMENT_REQUIRED.
 */
export function OpenWorkReassignDialog({ open, onOpenChange, openWork, candidates, isSubmitting, onConfirm }) {
  const { t } = useTranslation();
  const [reassignToUserId, setReassignToUserId] = useState('');

  const recallCount = openWork?.recallEntries?.length || 0;
  const followUpCount = openWork?.leadFollowUps?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('users.openWork.title', 'Reassign open work before continuing')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {t(
              'users.openWork.subtitle',
              'This staff member still owns open work that must be handed to someone else. Nothing has been changed yet.'
            )}
          </p>
          <ul className="list-disc space-y-1 pl-5">
            {recallCount > 0 && (
              <li>
                {t('users.openWork.recallCount', '{{count}} open recall worklist item(s)', {
                  count: recallCount,
                })}
              </li>
            )}
            {followUpCount > 0 && (
              <li>
                {t('users.openWork.followUpCount', '{{count}} upcoming lead follow-up task(s)', {
                  count: followUpCount,
                })}
              </li>
            )}
          </ul>

          <div className="space-y-2">
            <Label htmlFor="reassign-target">
              {t('users.openWork.reassignTo', 'Reassign to')}
            </Label>
            <Select
              id="reassign-target"
              value={reassignToUserId}
              onChange={(e) => setReassignToUserId(e.target.value)}
            >
              <option value="">{t('users.openWork.selectStaff', 'Select a staff member')}</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={!reassignToUserId || isSubmitting}
            onClick={() => onConfirm(reassignToUserId)}
          >
            {t('users.openWork.confirm', 'Reassign and continue')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OpenWorkReassignDialog;
