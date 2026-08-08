import { useState } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useFeedbackList, useResolveFeedback } from '@/modules/crm/hooks/useCrmExtensions';

const STATUSES = ['SUBMITTED', 'REVIEWED', 'ARCHIVED'];

/**
 * NEW panel — GET /crm-extensions/feedback and the resolve action already existed
 * on the backend and in useCrmExtensions.js, but no staff screen consumed them
 * (APP_ROUTES.CRM_FEEDBACK was a dangling constant with no route registration).
 * Escalation is deliberately not surfaced here: POST /feedback/:id/escalate
 * requires an `escalatedTo` user id, which needs a staff picker that is out of
 * scope for this consolidation.
 */
export function CrmFeedbackPanel() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('');
  const [complaintsOnly, setComplaintsOnly] = useState(false);
  const params = {
    ...(status ? { status } : {}),
    ...(complaintsOnly ? { isComplaint: 'true' } : {}),
  };
  const { data: items = [], isLoading } = useFeedbackList(params);
  const resolve = useResolveFeedback();
  const [resolving, setResolving] = useState(null);
  const [notes, setNotes] = useState('');

  const submitResolve = async (e) => {
    e.preventDefault();
    await resolve.mutateAsync({ id: resolving.id, payload: { resolutionNotes: notes || null } });
    setResolving(null);
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t(
          'crm.feedback.subtitle',
          'Patient ratings, NPS and complaints — review, then record how each one was closed'
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('crm.feedback.allStatuses', 'All statuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`crm.feedback.status.${s}`, s)}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={complaintsOnly}
            onChange={(e) => setComplaintsOnly(e.target.checked)}
          />
          {t('crm.feedback.complaintsOnly', 'Complaints only')}
        </label>
      </div>

      {isLoading && <Skeleton className="h-32 w-full" />}

      <div className="space-y-2">
        {items.map((f) => (
          <div
            key={f.id}
            className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {t('crm.feedback.clinicRating', 'Clinic')} {f.clinicRating}/5
                {f.doctorRating != null && ` · ${t('crm.feedback.doctorRating', 'Doctor')} ${f.doctorRating}/5`}
                {f.npsScore != null && ` · ${t('crm.feedback.nps', 'NPS')} ${f.npsScore}/10`}
                {f.isComplaint && (
                  <Badge variant="destructive" className="ml-2">
                    {t('crm.feedback.complaint', 'Complaint')}
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{f.comments || t('crm.feedback.noComment', 'No comment')}</p>
              <p className="text-xs text-muted-foreground">
                {f.createdAt ? new Date(f.createdAt).toLocaleString() : '—'}
                {f.resolvedAt
                  ? ` · ${t('crm.feedback.resolvedOn', 'Resolved')} ${new Date(f.resolvedAt).toLocaleDateString()}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={f.status === 'SUBMITTED' ? 'warning' : 'secondary'}>
                {t(`crm.feedback.status.${f.status}`, f.status)}
              </Badge>
              {!f.resolvedAt && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setResolving(f);
                    setNotes('');
                  }}
                >
                  {t('crm.feedback.resolve', 'Resolve')}
                </Button>
              )}
            </div>
          </div>
        ))}
        {!items.length && !isLoading && (
          <EmptyState
            icon={MessageSquareWarning}
            title={t('crm.feedback.empty', 'No feedback matches these filters.')}
          />
        )}
      </div>

      <Dialog open={Boolean(resolving)} onOpenChange={(v) => !v && setResolving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('crm.feedback.resolveTitle', 'Resolve feedback')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitResolve} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="resolutionNotes">{t('crm.feedback.resolutionNotes', 'Resolution notes')}</Label>
              <Input
                id="resolutionNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('crm.feedback.resolutionPlaceholder', 'What was done to close this out?')}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResolving(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={resolve.isPending}>
                {t('common.save', 'Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CrmFeedbackPanel;
