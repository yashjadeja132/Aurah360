import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { billingApi } from '@/modules/billing/api/billingApi';
import { APP_ROUTES, invoiceDetailPath } from '@/constants/routes';
import {
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatMoney,
} from '@/modules/billing/constants';

export default function InvoicePrintPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    billingApi
      .print(id)
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.message || t('billing.print.loadFailed', 'Failed to load print data')));
  }, [id]);

  const invoice = data?.invoice;

  if (error) return <p className="p-6 text-sm text-destructive">{error}</p>;
  if (!invoice) return <p className="p-6 text-sm text-muted-foreground">{t('billing.print.preparing', 'Preparing print…')}</p>;

  return (
    <section className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to={invoiceDetailPath(id)}>
            <ArrowLeft className="h-4 w-4" />
            {t('billing.print.back', 'Back')}
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          {t('billing.print.print', 'Print')}
        </Button>
      </div>

      <div className="space-y-6 rounded-xl border bg-white p-6 text-sm text-black">
        <header className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="mb-2 flex h-12 w-24 items-center justify-center border border-dashed text-xs text-muted-foreground">
              {t('billing.print.logo', 'LOGO')}
            </div>
            <h1 className="text-xl font-semibold">{t('billing.print.taxInvoice', 'Tax Invoice / Receipt')}</h1>
            <p>{invoice.branch?.name || t('billing.print.clinic', 'Clinic')}</p>
            <p className="text-xs text-muted-foreground">
              {t('billing.print.gstPlaceholder', 'GST placeholder')} {invoice.gstPlaceholder ? t('billing.print.on', 'ON') : t('billing.print.off', 'OFF')} · {invoice.taxPercent}%
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{invoice.invoiceNumber}</p>
            <p>{INVOICE_STATUS_LABELS[invoice.status]}</p>
            <p>{PAYMENT_STATUS_LABELS[invoice.paymentStatus]}</p>
            <div className="ml-auto mt-2 flex h-16 w-16 items-center justify-center border border-dashed text-[10px] text-muted-foreground">
              {t('billing.print.qr', 'QR')}
            </div>
          </div>
        </header>

        <section className="grid gap-2 sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">{t('billing.print.patient', 'Patient')}:</span> {invoice.patient?.fullName}
          </p>
          <p>
            <span className="text-muted-foreground">{t('billing.print.doctor', 'Doctor')}:</span> {invoice.doctor?.name || '—'}
          </p>
          <p>
            <span className="text-muted-foreground">{t('billing.print.date', 'Date')}:</span>{' '}
            {invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString() : '—'}
          </p>
          <p>
            <span className="text-muted-foreground">{t('billing.print.mrn', 'MRN')}:</span> {invoice.patient?.mrn}
          </p>
        </section>

        {invoice.packageSnapshot && (
          <section>
            <h2 className="mb-1 font-semibold">{t('billing.print.package', 'Package')}</h2>
            <p>
              {invoice.packageSnapshot.packageName} —{' '}
              {formatMoney(invoice.packageSnapshot.packagePrice)}
            </p>
          </section>
        )}

        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th className="py-1">{t('billing.print.description', 'Description')}</th>
              <th className="py-1">{t('billing.print.qty', 'Qty')}</th>
              <th className="py-1">{t('billing.print.rate', 'Rate')}</th>
              <th className="py-1">{t('billing.print.total', 'Total')}</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((it) => (
              <tr key={it.id || it.description} className="border-b border-dashed">
                <td className="py-1">
                  {it.description}
                  <span className="block text-[10px] text-muted-foreground">{it.itemType}</span>
                </td>
                <td className="py-1">{it.quantity}</td>
                <td className="py-1">{formatMoney(it.unitPrice)}</td>
                <td className="py-1">{formatMoney(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto w-56 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>{t('billing.print.subtotal', 'Subtotal')}</span>
            <span>{formatMoney(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('billing.print.discount', 'Discount')}</span>
            <span>{formatMoney(invoice.discount)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('billing.print.taxGst', 'Tax (GST)')}</span>
            <span>{formatMoney(invoice.tax)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>{t('billing.print.total', 'Total')}</span>
            <span>{formatMoney(invoice.total)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('billing.print.paid', 'Paid')}</span>
            <span>{formatMoney(invoice.paidAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>{t('billing.print.balance', 'Balance')}</span>
            <span>{formatMoney(invoice.balanceAmount)}</span>
          </div>
        </div>

        <section>
          <h2 className="mb-2 font-semibold">{t('billing.print.paymentReceipt', 'Payment receipt')}</h2>
          {(invoice.payments || []).map((p) => (
            <p key={p.id}>
              {p.receiptNumber}: {p.method} {formatMoney(p.amount)}
              {p.paidAt ? ` · ${new Date(p.paidAt).toLocaleString()}` : ''}
            </p>
          ))}
          {!invoice.payments?.length && <p>—</p>}
        </section>

        <footer className="mt-10 grid gap-8 sm:grid-cols-2">
          <div className="border-t pt-2">{t('billing.print.authorizedSignature', 'Authorized signature')}</div>
          <div className="border-t pt-2">{t('billing.print.patientPayer', 'Patient / payer')}</div>
        </footer>
      </div>

      <Link to={APP_ROUTES.BILLING} className="text-sm underline print:hidden">
        {t('billing.print.allInvoices', 'All invoices')}
      </Link>
    </section>
  );
}
