import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { useLoyaltyTiers, useUpsertLoyaltyTier, useLoyaltySettings } from '@/modules/loyalty/hooks/useLoyalty';

const QUALIFICATION_BASIS = ['POINTS_EARNED_ROLLING_12M', 'VISITS_COUNT_ROLLING_12M', 'SPEND_ROLLING_12M'];

const EMPTY_TIER = {
  name: '',
  rank: 0,
  qualificationBasis: 'POINTS_EARNED_ROLLING_12M',
  threshold: 0,
  earningMultiplier: 1,
  downgradeGracePeriodDays: 30,
  benefits: { birthdayBonusMultiplier: 1, priorityBookingFlag: false, offerSegmentTag: '' },
};

/** Optional tier ladder for benefits/marketing segmentation (was LoyaltyTiersPage). */
export function LoyaltyTiersPanel() {
  const { t } = useTranslation();
  const { data: settings } = useLoyaltySettings();
  const { data, isLoading } = useLoyaltyTiers();
  const upsert = useUpsertLoyaltyTier();
  const [editing, setEditing] = useState(null);
  const tiers = (data?.items || []).slice().sort((a, b) => a.rank - b.rank);

  const openNew = () => setEditing({ ...EMPTY_TIER });
  const openEdit = (tier) => setEditing({ ...tier });

  const submit = async (e) => {
    e.preventDefault();
    await upsert.mutateAsync(editing);
    setEditing(null);
  };

  const setField = (key, value) => setEditing((prev) => ({ ...prev, [key]: value }));
  const setBenefit = (key, value) =>
    setEditing((prev) => ({ ...prev, benefits: { ...prev.benefits, [key]: value } }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t('loyalty.tiers.subtitle', 'Optional tier system for benefits and marketing segmentation')}
        </p>
        <PermissionGuard permissions={[PERMISSIONS.LOYALTY_SETTINGS_MANAGE, PERMISSIONS.LOYALTY_ALL]}>
          <Button onClick={openNew}>{t('loyalty.tiers.newTier', 'New tier')}</Button>
        </PermissionGuard>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm">
        <Badge variant={settings?.tiersEnabled ? 'success' : 'secondary'}>
          {settings?.tiersEnabled ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled (default)')}
        </Badge>
        <p>
          {t(
            'loyalty.tiers.clinicalBoundaryNote',
            'Tiers are OFF by default and are a service/marketing benefits feature only. They NEVER affect clinical queue priority.'
          )}
        </p>
      </div>

      {isLoading && <Skeleton className="h-32 w-full" />}

      <div className="space-y-2">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {tier.name} <span className="text-xs text-muted-foreground">rank {tier.rank}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {t(`loyalty.qualificationBasis.${tier.qualificationBasis}`, tier.qualificationBasis)} ≥ {tier.threshold}
                {' · '}
                {t('loyalty.tiers.multiplier', 'multiplier')} {tier.earningMultiplier}x
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={tier.isActive ? 'success' : 'secondary'}>
                {tier.isActive ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
              </Badge>
              <PermissionGuard permissions={[PERMISSIONS.LOYALTY_SETTINGS_MANAGE, PERMISSIONS.LOYALTY_ALL]}>
                <Button size="sm" variant="outline" onClick={() => openEdit(tier)}>
                  {t('common.edit', 'Edit')}
                </Button>
              </PermissionGuard>
            </div>
          </div>
        ))}
        {!tiers.length && !isLoading && (
          <EmptyState title={t('loyalty.tiers.empty', 'No tiers configured yet.')} />
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.id ? t('loyalty.tiers.editTitle', 'Edit tier') : t('loyalty.tiers.newTierTitle', 'New tier')}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t('loyalty.tiers.fields.name', 'Name')}</Label>
                  <Input value={editing.name} onChange={(e) => setField('name', e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('loyalty.tiers.fields.rank', 'Rank (0 = lowest)')}</Label>
                  <Input type="number" value={editing.rank} onChange={(e) => setField('rank', Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('loyalty.tiers.fields.qualificationBasis', 'Qualification basis')}</Label>
                  <Select value={editing.qualificationBasis} onChange={(e) => setField('qualificationBasis', e.target.value)}>
                    {QUALIFICATION_BASIS.map((v) => (
                      <option key={v} value={v}>
                        {t(`loyalty.qualificationBasis.${v}`, v)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('loyalty.tiers.fields.threshold', 'Threshold')}</Label>
                  <Input type="number" value={editing.threshold} onChange={(e) => setField('threshold', Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('loyalty.tiers.fields.earningMultiplier', 'Earning multiplier')}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editing.earningMultiplier}
                    onChange={(e) => setField('earningMultiplier', Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('loyalty.tiers.fields.downgradeGracePeriodDays', 'Downgrade grace period (days)')}</Label>
                  <Input
                    type="number"
                    value={editing.downgradeGracePeriodDays}
                    onChange={(e) => setField('downgradeGracePeriodDays', Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">{t('loyalty.tiers.fields.benefits', 'Benefits')}</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>{t('loyalty.tiers.fields.birthdayBonusMultiplier', 'Birthday bonus multiplier')}</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={editing.benefits?.birthdayBonusMultiplier ?? 1}
                      onChange={(e) => setBenefit('birthdayBonusMultiplier', Number(e.target.value))}
                    />
                  </div>
                  <div className="flex items-center gap-2 self-end">
                    <input
                      id="priorityBookingFlag"
                      type="checkbox"
                      checked={Boolean(editing.benefits?.priorityBookingFlag)}
                      onChange={(e) => setBenefit('priorityBookingFlag', e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="priorityBookingFlag">
                      {t('loyalty.tiers.fields.priorityBookingFlag', 'Priority booking flag (service, not clinical)')}
                    </Label>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t('loyalty.tiers.fields.offerSegmentTag', 'Offer segment tag')}</Label>
                    <Input
                      value={editing.benefits?.offerSegmentTag ?? ''}
                      onChange={(e) => setBenefit('offerSegmentTag', e.target.value)}
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t(
                    'loyalty.tiers.priorityBookingDisclaimer',
                    'This flag only affects the front-desk booking UI/marketing offers — it never changes clinical triage or queue ordering.'
                  )}
                </p>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button type="submit" disabled={upsert.isPending}>
                  {t('common.save', 'Save')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LoyaltyTiersPanel;
