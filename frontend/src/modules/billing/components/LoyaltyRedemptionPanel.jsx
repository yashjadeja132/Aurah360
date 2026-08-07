import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import {
  useLoyaltySettings,
  usePatientBalance,
  useApplyLoyaltyRedemption,
  useRemoveLoyaltyRedemption,
} from '@/modules/loyalty/hooks/useLoyalty';
import { formatMoney } from '../constants';
import { PERMISSIONS } from '@/constants/rbac';

/**
 * DRAFT-invoice-only "Redeem loyalty points" section — same lifecycle stage as the discount
 * fields above it. Hidden entirely (not disabled) when the program is off or the patient has
 * no redeemable balance (LOY-005).
 */
export function LoyaltyRedemptionPanel({ invoiceId, patientId, invoice }) {
  const { t } = useTranslation();
  const [points, setPoints] = useState('');

  const { data: settings, isLoading: settingsLoading } = useLoyaltySettings();
  const { data: balance, isLoading: balanceLoading } = usePatientBalance(patientId);
  const applyRedemption = useApplyLoyaltyRedemption(invoiceId);
  const removeRedemption = useRemoveLoyaltyRedemption(invoiceId);

  const appliedRedemption = invoice?.loyaltyRedemption || null;

  const redeemableBalance = balance?.redeemableBalance ?? 0;
  const pointsPerRupee = settings?.redemptionPointsPerRupee || 10;
  const stepPoints = settings?.redemptionStepPoints || 1;
  const minimumPoints = settings?.minimumPointsToRedeem || 0;
  const maxPercent = settings?.maxRedemptionPercentPerInvoice;
  const maxFlatInr = settings?.maxRedemptionFlatInrPerInvoice;

  const inrPreview = useMemo(() => {
    const p = Number(points) || 0;
    return p / pointsPerRupee;
  }, [points, pointsPerRupee]);

  const clientCapInr = useMemo(() => {
    if (!invoice) return null;
    if (maxPercent != null) return (Number(invoice.subtotal || invoice.total) * maxPercent) / 100;
    if (maxFlatInr != null) return maxFlatInr;
    return null;
  }, [invoice, maxPercent, maxFlatInr]);

  const clientValidationError = (() => {
    const p = Number(points) || 0;
    if (!p) return null;
    if (p % stepPoints !== 0) {
      return t('billing.redeem.stepError', 'Points must be a multiple of {{step}}', { step: stepPoints });
    }
    if (p < minimumPoints) {
      return t('billing.redeem.minError', 'Minimum {{min}} points required to redeem', { min: minimumPoints });
    }
    if (p > redeemableBalance) {
      return t('billing.redeem.balanceError', 'Cannot exceed redeemable balance of {{balance}}', {
        balance: redeemableBalance,
      });
    }
    if (clientCapInr != null && inrPreview > clientCapInr) {
      return t('billing.redeem.capError', 'Redemption discount cannot exceed {{cap}}', {
        cap: formatMoney(clientCapInr),
      });
    }
    return null;
  })();

  if (settingsLoading || balanceLoading) return null;
  // LOY-001 kill switch, or patient has nothing to redeem — don't render the section at all.
  if (settings?.programEnabled === false) return null;
  if (!appliedRedemption && redeemableBalance <= 0) return null;

  return (
    <PermissionGuard permissions={[PERMISSIONS.LOYALTY_REDEEM, PERMISSIONS.BILLING_ALL]}>
      <div className="space-y-3 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('billing.redeem.title', 'Redeem loyalty points')}</h2>
          <Badge variant="secondary">
            {t('billing.redeem.availableBalance', '{{balance}} points available', { balance: redeemableBalance })}
          </Badge>
        </div>

        {appliedRedemption ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-info/40 bg-info-soft px-3 py-2 text-sm">
            <span>
              {t('billing.redeem.appliedLine', 'Loyalty redemption: {{points}} points = {{value}} off', {
                points: appliedRedemption.points,
                value: formatMoney(appliedRedemption.valueInr),
              })}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={removeRedemption.isPending}
              onClick={() => removeRedemption.mutate()}
            >
              {t('billing.redeem.remove', 'Remove')}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>{t('billing.redeem.pointsToRedeem', 'Points to redeem')}</Label>
              <Input
                type="number"
                step={stepPoints}
                min={0}
                max={redeemableBalance}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>
            <div>
              <Label>{t('billing.redeem.discountPreview', 'Discount preview')}</Label>
              <p className="mt-2 text-sm font-medium">{formatMoney(inrPreview)}</p>
            </div>
            <div className="flex items-end">
              <Button
                disabled={!points || Boolean(clientValidationError) || applyRedemption.isPending}
                onClick={() =>
                  applyRedemption.mutate(
                    { points: Number(points) },
                    { onSuccess: () => setPoints('') }
                  )
                }
              >
                {t('billing.redeem.apply', 'Apply redemption')}
              </Button>
            </div>
            {clientValidationError && (
              <p className="text-xs text-destructive sm:col-span-3">{clientValidationError}</p>
            )}
            <p className="text-xs text-muted-foreground sm:col-span-3">
              {t(
                'billing.redeem.stepHint',
                'Redeem in multiples of {{step}} points · {{ppr}} points = ₹1 · minimum {{min}} points',
                { step: stepPoints, ppr: pointsPerRupee, min: minimumPoints }
              )}
            </p>
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}

export default LoyaltyRedemptionPanel;
