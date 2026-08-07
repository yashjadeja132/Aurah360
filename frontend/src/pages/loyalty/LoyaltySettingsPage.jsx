import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { hasAnyPermission } from '@/utils/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/constants/rbac';
import { useLoyaltySettings, useUpdateLoyaltySettings } from '@/modules/loyalty/hooks/useLoyalty';

const FIELDS = [
  { key: 'programDisplayName', type: 'text', labelKey: 'programDisplayName', label: 'Program display name' },
  { key: 'redemptionPointsPerRupee', type: 'number', labelKey: 'redemptionPointsPerRupee', label: 'Points per ₹1 redeemed' },
  { key: 'minimumPointsToRedeem', type: 'number', labelKey: 'minimumPointsToRedeem', label: 'Minimum points to redeem' },
  { key: 'maxRedemptionPercentPerInvoice', type: 'number', labelKey: 'maxRedemptionPercentPerInvoice', label: 'Max redemption % per invoice' },
  { key: 'maxRedemptionFlatInrPerInvoice', type: 'number', labelKey: 'maxRedemptionFlatInrPerInvoice', label: 'Max redemption flat ₹ per invoice' },
  { key: 'redemptionStepPoints', type: 'number', labelKey: 'redemptionStepPoints', label: 'Redemption step (points)' },
  { key: 'pointsExpiryMonths', type: 'number', labelKey: 'pointsExpiryMonths', label: 'Points expiry (months, blank = never)' },
  { key: 'ruleChangeApprovalThresholdPercent', type: 'number', labelKey: 'ruleChangeApprovalThresholdPercent', label: 'Rule-change approval threshold (%)' },
];

export default function LoyaltySettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data, isLoading } = useLoyaltySettings();
  const update = useUpdateLoyaltySettings();
  const [form, setForm] = useState(null);

  const canManage = hasAnyPermission(user?.permissions, [
    PERMISSIONS.LOYALTY_SETTINGS_MANAGE,
    PERMISSIONS.LOYALTY_ALL,
  ]);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form) return;
    update.mutate(form);
  };

  return (
    <PermissionGuard
      permissions={[PERMISSIONS.LOYALTY_SETTINGS_VIEW, PERMISSIONS.LOYALTY_SETTINGS_MANAGE, PERMISSIONS.LOYALTY_ALL]}
      fallback="redirect"
    >
      <section className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('loyalty.settings.title', 'Loyalty program settings')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'loyalty.settings.subtitle',
              'Global program configuration. Changes create a new effective-dated version and never rewrite history.'
            )}
          </p>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>}

        {form && (
          <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border bg-card p-6">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{t('loyalty.settings.programEnabled', 'Program enabled')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('loyalty.settings.programEnabledHint', 'OFF blocks new accrual/redemption; existing balances are untouched.')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={form.programEnabled ? 'success' : 'secondary'}>
                  {form.programEnabled
                    ? t('common.enabled', 'Enabled')
                    : t('common.disabled', 'Disabled')}
                </Badge>
                <input
                  type="checkbox"
                  checked={Boolean(form.programEnabled)}
                  disabled={!canManage}
                  onChange={(e) => setField('programEnabled', e.target.checked)}
                  className="h-4 w-4"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key}>{t(`loyalty.settings.fields.${f.labelKey}`, f.label)}</Label>
                  <Input
                    id={f.key}
                    type={f.type}
                    disabled={!canManage}
                    value={form[f.key] ?? ''}
                    onChange={(e) =>
                      setField(f.key, f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)
                    }
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{t('loyalty.settings.tiersEnabled', 'Tiers enabled')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('loyalty.settings.tiersEnabledHint', 'Off by default. Tiers are a benefits/marketing feature only — never affects clinical queue priority.')}
                </p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(form.tiersEnabled)}
                disabled={!canManage}
                onChange={(e) => setField('tiersEnabled', e.target.checked)}
                className="h-4 w-4"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="earnOnRedeemedPortion">
                {t('loyalty.settings.earnOnRedeemedPortion', 'Earn points on redeemed portion of a bill')}
              </Label>
              <input
                id="earnOnRedeemedPortion"
                type="checkbox"
                checked={Boolean(form.earnOnRedeemedPortion)}
                disabled={!canManage}
                onChange={(e) => setField('earnOnRedeemedPortion', e.target.checked)}
                className="h-4 w-4"
              />
            </div>

            {!canManage && (
              <p className="text-xs text-muted-foreground">
                {t('loyalty.settings.viewOnly', 'You have view-only access to these settings.')}
              </p>
            )}

            {canManage && (
              <Button type="submit" disabled={update.isPending}>
                {t('loyalty.settings.save', 'Save settings')}
              </Button>
            )}
          </form>
        )}
      </section>
    </PermissionGuard>
  );
}
