import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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

/** Comma-separated list fields — stored as string[] on the backend. */
const LIST_FIELDS = [
  {
    key: 'expiryReminderDaysBefore',
    labelKey: 'expiryReminderDaysBefore',
    label: 'Expiry reminders (days before, comma-separated)',
    numeric: true,
  },
  {
    key: 'excludedRedemptionCategories',
    labelKey: 'excludedRedemptionCategories',
    label: 'Excluded items from redemption (category codes, comma-separated)',
    numeric: false,
  },
];

/** LOY-005 — how a redemption at point-of-sale confirms identity. See
 *  LoyaltyProgramSettings.model.js for the full behaviour of each option. */
const REDEMPTION_IDENTITY_CONFIRMATION_OPTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'IN_PERSON', label: 'In-person' },
  { value: 'OTP', label: 'OTP' },
];

/** LOY-006 — what happens to a refund's re-credit when the original points already expired. */
const EXPIRED_REDEMPTION_RESTORE_POLICY_OPTIONS = [
  { value: 'RESTORE_SHORT_EXPIRY', label: 'Restore with short expiry' },
  { value: 'FORFEIT', label: 'Forfeit' },
];

/**
 * Rendered when the settings query resolves to null/undefined so the form is
 * still usable — the backend always returns program defaults, this is defensive.
 */
const EMPTY_SETTINGS = {
  programEnabled: false,
  tiersEnabled: false,
  earnOnRedeemedPortion: false,
};

/**
 * A cleared number input becomes null and a cleared text input becomes ''.
 * Several backend fields (redemptionPointsPerRupee, minimumPointsToRedeem,
 * redemptionStepPoints, programDisplayName) reject null/empty, so drop those
 * keys entirely — an untouched/cleared field means "leave unchanged".
 */
function buildSettingsPayload(form) {
  const base = Object.fromEntries(
    Object.entries(form).filter(([, value]) => value !== null && value !== '')
  );
  LIST_FIELDS.forEach(({ key, numeric }) => {
    const raw = form[key];
    if (typeof raw !== 'string') return; // already an array (untouched) — leave as-is
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (numeric ? Number(s) : s));
    base[key] = parts;
  });
  return base;
}

/** Arrays arrive from the API; the inputs edit them as comma-separated text. */
function toListInputValue(value) {
  return Array.isArray(value) ? value.join(', ') : value ?? '';
}

/** Global program configuration (was LoyaltySettingsPage). */
export function LoyaltySettingsPanel() {
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
    if (!isLoading) setForm(data || EMPTY_SETTINGS);
  }, [data, isLoading]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form) return;

    // ⚠ Dangerous change — turning the program OFF or changing the redemption conversion rate
    // is a direct money/liability move. Surface an impact summary and require explicit
    // confirmation before saving (server-side step-up is enforced separately on PUT /settings).
    const wasEnabled = data?.programEnabled;
    const isNowDisabled = wasEnabled && !form.programEnabled;
    const rateChanged =
      data?.redemptionPointsPerRupee != null &&
      Number(form.redemptionPointsPerRupee) !== Number(data.redemptionPointsPerRupee);

    if (isNowDisabled || rateChanged) {
      const parts = [];
      if (isNowDisabled) {
        parts.push('turn the loyalty program OFF — new accrual and redemption will stop immediately (existing balances are kept)');
      }
      if (rateChanged) {
        parts.push(
          `change the redemption rate from ${data.redemptionPointsPerRupee} to ${form.redemptionPointsPerRupee} points per ₹1 — this changes the ₹ value of every patient's outstanding points balance`
        );
      }
      const confirmed = window.confirm(
        `This will ${parts.join(' and ')}.\n\nThis is a dangerous change. Continue?`
      );
      if (!confirmed) return;
    }

    update.mutate(buildSettingsPayload(form));
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t(
          'loyalty.settings.subtitle',
          'Global program configuration. Changes create a new effective-dated version and never rewrite history.'
        )}
      </p>

      {isLoading && <Skeleton className="h-64 w-full" />}

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
                {form.programEnabled ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
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
                    setField(
                      f.key,
                      f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value
                    )
                  }
                />
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {LIST_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{t(`loyalty.settings.fields.${f.labelKey}`, f.label)}</Label>
                <Input
                  id={f.key}
                  type="text"
                  disabled={!canManage}
                  value={toListInputValue(form[f.key])}
                  onChange={(e) => setField(f.key, e.target.value)}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="redemptionIdentityConfirmation">
                {t('loyalty.settings.fields.redemptionIdentityConfirmation', 'Redemption identity confirmation')}
              </Label>
              <Select
                id="redemptionIdentityConfirmation"
                disabled={!canManage}
                value={form.redemptionIdentityConfirmation ?? 'NONE'}
                onChange={(e) => setField('redemptionIdentityConfirmation', e.target.value)}
              >
                {REDEMPTION_IDENTITY_CONFIRMATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(`loyalty.settings.redemptionIdentityConfirmationOption.${o.value}`, o.label)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                {t(
                  'loyalty.settings.redemptionIdentityConfirmationHint',
                  'None = no gate. In-person = staff confirm identity before redeeming. OTP = an OTP must be verified before redeeming.'
                )}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expiredRedemptionRestorePolicy">
                {t('loyalty.settings.fields.expiredRedemptionRestorePolicy', 'Expired redemption restore policy')}
              </Label>
              <Select
                id="expiredRedemptionRestorePolicy"
                disabled={!canManage}
                value={form.expiredRedemptionRestorePolicy ?? 'RESTORE_SHORT_EXPIRY'}
                onChange={(e) => setField('expiredRedemptionRestorePolicy', e.target.value)}
              >
                {EXPIRED_REDEMPTION_RESTORE_POLICY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(`loyalty.settings.expiredRedemptionRestorePolicyOption.${o.value}`, o.label)}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                {t(
                  'loyalty.settings.expiredRedemptionRestorePolicyHint',
                  'On a refund, controls whether previously-redeemed points that have since expired are re-credited with a fresh short expiry, or forfeited.'
                )}
              </p>
            </div>
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
    </div>
  );
}

export default LoyaltySettingsPanel;
