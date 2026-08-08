import { Link } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useInvoices } from '@/modules/billing/hooks/useBilling';
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatMoney,
} from '@/modules/billing/constants';
import { invoiceDetailPath } from '@/constants/routes';

/** Billing history inside the 360° patient profile — no navigation away from the profile. */
export function PatientBillingPanel({ patientId }) {
  const { t } = useTranslation();
  const { data, isLoading } = useInvoices({ patientId, limit: 50 });
  const invoices = data?.items || [];

  if (isLoading) return <Skeleton className="h-60 w-full" />;

  if (!invoices.length) {
    return (
      <EmptyState
        icon={Receipt}
        title={t('patients.detail.billing.emptyTitle', 'No invoices')}
        description={t('patients.detail.billing.emptyDescription', 'This patient has no billing history yet.')}
      />
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {invoices.map((inv) => (
        <li key={inv.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Receipt className="h-4 w-4 text-primary" />
            <div>
              <p className="font-medium">
                {inv.invoiceNumber} ·{' '}
                {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatMoney(inv.total)} · {t('patients.detail.billing.paid', 'Paid')} {formatMoney(inv.paidAmount)} ·{' '}
                {t('patients.detail.billing.balance', 'Balance')} {formatMoney(inv.balanceAmount)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={inv.status === 'FINALIZED' ? 'success' : 'warning'}>
              {INVOICE_STATUS_LABELS[inv.status] || inv.status}
            </Badge>
            <Badge variant="outline">{PAYMENT_STATUS_LABELS[inv.paymentStatus] || inv.paymentStatus}</Badge>
            <Button asChild variant="outline" size="sm">
              <Link to={invoiceDetailPath(inv.id)}>{t('patients.detail.billing.open', 'Open')}</Link>
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default PatientBillingPanel;
