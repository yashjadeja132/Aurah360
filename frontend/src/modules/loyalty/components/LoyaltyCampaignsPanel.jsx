import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  useLoyaltyCampaigns,
  useCreateLoyaltyCampaign,
  useUpdateCampaignStatus,
} from '@/modules/loyalty/hooks/useLoyalty';

const STATUS_VARIANT = {
  DRAFT: 'secondary',
  SCHEDULED: 'info',
  ACTIVE: 'success',
  ENDED: 'outline',
  CANCELLED: 'destructive',
};

const EMPTY_DRAFT = {
  name: '',
  multiplier: 2,
  appliesToRuleCodes: '',
  startDate: '',
  endDate: '',
  audienceSegment: '',
};

/** Point-multiplier campaigns and their status transitions (was LoyaltyCampaignsPage). */
export function LoyaltyCampaignsPanel() {
  const { t } = useTranslation();
  const { data, isLoading } = useLoyaltyCampaigns();
  const createCampaign = useCreateLoyaltyCampaign();
  const updateStatus = useUpdateCampaignStatus();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const campaigns = data?.items || [];

  const setField = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    await createCampaign.mutateAsync({
      ...draft,
      multiplier: Number(draft.multiplier),
      appliesToRuleCodes: draft.appliesToRuleCodes
        ? draft.appliesToRuleCodes.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    });
    setOpen(false);
    setDraft(EMPTY_DRAFT);
  };

  const transition = (id, status) => updateStatus.mutate({ id, status });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t('loyalty.campaigns.subtitle', 'Date/branch/service-targeted point multiplier campaigns')}
        </p>
        <Button onClick={() => setOpen(true)}>{t('loyalty.campaigns.newCampaign', 'New campaign')}</Button>
      </div>

      {isLoading && <Skeleton className="h-32 w-full" />}

      <div className="space-y-2">
        {campaigns.map((c) => (
          <div
            key={c.id}
            className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {c.name} <span className="text-xs text-muted-foreground">{c.multiplier}x</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(c.startDate).toLocaleDateString()} – {new Date(c.endDate).toLocaleDateString()}
                {c.audienceSegment ? ` · ${c.audienceSegment}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[c.status] || 'secondary'}>
                {t(`loyalty.campaignStatus.${c.status}`, c.status)}
              </Badge>
              {c.status === 'DRAFT' && (
                <Button size="sm" variant="outline" onClick={() => transition(c.id, 'SCHEDULED')}>
                  {t('loyalty.campaigns.approve', 'Approve')}
                </Button>
              )}
              {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                <Button size="sm" variant="outline" onClick={() => transition(c.id, 'ACTIVE')}>
                  {t('loyalty.campaigns.activate', 'Activate')}
                </Button>
              )}
              {c.status !== 'ENDED' && c.status !== 'CANCELLED' && (
                <Button size="sm" variant="destructive" onClick={() => transition(c.id, 'CANCELLED')}>
                  {t('loyalty.campaigns.cancel', 'Cancel')}
                </Button>
              )}
            </div>
          </div>
        ))}
        {!campaigns.length && !isLoading && (
          <EmptyState title={t('loyalty.campaigns.empty', 'No campaigns yet.')} />
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('loyalty.campaigns.newCampaignTitle', 'New campaign')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t('loyalty.campaigns.fields.name', 'Name')}</Label>
                <Input value={draft.name} onChange={(e) => setField('name', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t('loyalty.campaigns.fields.multiplier', 'Multiplier')}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="1"
                  value={draft.multiplier}
                  onChange={(e) => setField('multiplier', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('loyalty.campaigns.fields.appliesToRuleCodes', 'Applies to rule codes (comma-separated)')}</Label>
                <Input value={draft.appliesToRuleCodes} onChange={(e) => setField('appliesToRuleCodes', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('loyalty.campaigns.fields.startDate', 'Start date')}</Label>
                <Input type="date" value={draft.startDate} onChange={(e) => setField('startDate', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>{t('loyalty.campaigns.fields.endDate', 'End date')}</Label>
                <Input type="date" value={draft.endDate} onChange={(e) => setField('endDate', e.target.value)} required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>{t('loyalty.campaigns.fields.audienceSegment', 'Audience segment (optional)')}</Label>
                <Input value={draft.audienceSegment} onChange={(e) => setField('audienceSegment', e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={createCampaign.isPending}>
                {t('common.save', 'Save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LoyaltyCampaignsPanel;
