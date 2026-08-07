import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PAYMENT_METHOD_OPTIONS, formatMoney } from '../constants';

export function PaymentDialog({ open, balance, onClose, onSubmit, pending }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('single');
  const [amount, setAmount] = useState(String(balance || ''));
  const [method, setMethod] = useState('CASH');
  const [reference, setReference] = useState('');
  const [isAdvance, setIsAdvance] = useState(false);
  const [splitA, setSplitA] = useState({ method: 'CASH', amount: '' });
  const [splitB, setSplitB] = useState({ method: 'UPI', amount: '' });

  if (!open) return null;

  const submit = () => {
    if (mode === 'split') {
      onSubmit({
        method: 'SPLIT',
        splits: [
          { method: splitA.method, amount: Number(splitA.amount) || 0 },
          { method: splitB.method, amount: Number(splitB.amount) || 0 },
        ],
        isAdvance,
        reference: reference || null,
      });
    } else {
      onSubmit({
        amount: Number(amount) || 0,
        method,
        isAdvance,
        reference: reference || null,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('billing.paymentDialog.title', 'Record payment')}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t('billing.paymentDialog.close', 'Close')}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t('billing.paymentDialog.balanceDue', 'Balance due')}: {formatMoney(balance)}</p>

        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === 'single' ? 'default' : 'outline'}
            onClick={() => setMode('single')}
          >
            {t('billing.paymentDialog.single', 'Single')}
          </Button>
          <Button
            size="sm"
            variant={mode === 'split' ? 'default' : 'outline'}
            onClick={() => setMode('split')}
          >
            {t('billing.paymentDialog.split', 'Split')}
          </Button>
        </div>

        {mode === 'single' ? (
          <div className="grid gap-3">
            <div>
              <Label>{t('billing.paymentDialog.amount', 'Amount')}</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>{t('billing.paymentDialog.method', 'Method')}</Label>
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHOD_OPTIONS.filter((m) => m.value !== 'SPLIT').map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t('billing.paymentDialog.split1Method', 'Split 1 method')}</Label>
                <Select
                  value={splitA.method}
                  onChange={(e) => setSplitA((s) => ({ ...s, method: e.target.value }))}
                >
                  {PAYMENT_METHOD_OPTIONS.filter((m) => m.value !== 'SPLIT').map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>{t('billing.paymentDialog.amount', 'Amount')}</Label>
                <Input
                  type="number"
                  value={splitA.amount}
                  onChange={(e) => setSplitA((s) => ({ ...s, amount: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>{t('billing.paymentDialog.split2Method', 'Split 2 method')}</Label>
                <Select
                  value={splitB.method}
                  onChange={(e) => setSplitB((s) => ({ ...s, method: e.target.value }))}
                >
                  {PAYMENT_METHOD_OPTIONS.filter((m) => m.value !== 'SPLIT').map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>{t('billing.paymentDialog.amount', 'Amount')}</Label>
                <Input
                  type="number"
                  value={splitB.amount}
                  onChange={(e) => setSplitB((s) => ({ ...s, amount: e.target.value }))}
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <Label>{t('billing.paymentDialog.reference', 'Reference')}</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isAdvance} onChange={(e) => setIsAdvance(e.target.checked)} />
          {t('billing.paymentDialog.advanceAdjustment', 'Advance adjustment')}
        </label>

        <Button className="w-full" disabled={pending} onClick={submit}>
          {t('billing.paymentDialog.title', 'Record payment')}
        </Button>
      </div>
    </div>
  );
}

export default PaymentDialog;
