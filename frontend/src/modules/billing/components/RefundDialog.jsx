import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { REFUND_REASON_OPTIONS, REFUND_MODE_OPTIONS, formatMoney } from '../constants';

/**
 * A.8 — refund a single recorded payment. The reason is MANDATORY and comes from the controlled
 * REFUND_REASON list (the server rejects anything else); OTHER additionally requires notes.
 * Modelled on PaymentDialog so the two cashier dialogs behave identically.
 */
export function RefundDialog({ open, payment, onClose, onSubmit, pending }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState('ORIGINAL_MODE');
  const [notes, setNotes] = useState('');

  if (!open || !payment) return null;

  const maxAmount = Number(payment.amount) || 0;
  const requested = amount === '' ? maxAmount : Number(amount) || 0;
  const notesRequired = reason === 'OTHER';
  const invalid =
    !reason ||
    (notesRequired && !notes.trim()) ||
    requested <= 0 ||
    requested > maxAmount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('billing.refundDialog.title', 'Refund payment')}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('billing.refundDialog.close', 'Close')}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          {payment.paymentNumber} · {payment.method} ·{' '}
          {t('billing.refundDialog.original', 'Original amount')}: {formatMoney(maxAmount)}
        </p>

        <div>
          <Label>{t('billing.refundDialog.amount', 'Refund amount')}</Label>
          <Input
            type="number"
            value={amount}
            placeholder={String(maxAmount)}
            onChange={(e) => setAmount(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t('billing.refundDialog.amountHint', 'Leave blank to refund the full payment. Cannot exceed {{max}}.', {
              max: formatMoney(maxAmount),
            })}
          </p>
        </div>

        <div>
          <Label>
            {t('billing.refundDialog.reason', 'Reason')} <span className="text-destructive">*</span>
          </Label>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">{t('billing.refundDialog.reasonPlaceholder', 'Select a reason…')}</option>
            {REFUND_REASON_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(`billing.refundDialog.reasonOption.${o.value}`, o.label)}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>{t('billing.refundDialog.mode', 'Refund mode')}</Label>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {REFUND_MODE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(`billing.refundDialog.modeOption.${o.value}`, o.label)}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label>
            {t('billing.refundDialog.notes', 'Notes')}
            {notesRequired && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              notesRequired
                ? t('billing.refundDialog.notesRequiredPlaceholder', 'Required — explain the refund')
                : t('billing.refundDialog.notesPlaceholder', 'Optional detail')
            }
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {t(
              'billing.refundDialog.loyaltyWarning',
              'Loyalty points earned on this invoice are clawed back automatically. Points the patient already redeemed are not reversed.'
            )}
          </p>
        </div>

        {invalid && (
          <p className="text-xs font-medium text-destructive">
            {!reason
              ? t('billing.refundDialog.reasonRequired', 'A reason is required to refund.')
              : notesRequired && !notes.trim()
                ? t('billing.refundDialog.notesRequired', 'Notes are required when the reason is Other.')
                : t('billing.refundDialog.amountInvalid', 'Enter an amount between 0 and the original payment.')}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('billing.refundDialog.cancel', 'Cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={invalid || pending}
            onClick={() =>
              onSubmit({
                paymentId: payment.id,
                amount: requested,
                reason,
                method,
                notes: notes.trim() || null,
              })
            }
          >
            {t('billing.refundDialog.submit', 'Refund')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default RefundDialog;
