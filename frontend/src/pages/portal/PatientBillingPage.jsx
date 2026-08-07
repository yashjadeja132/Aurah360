import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { usePatientInvoices } from '@/modules/patientPortal/hooks/usePatientPortal';
import { patientPortalApi } from '@/modules/patientPortal/api/patientApi';

export default function PatientBillingPage() {
  const { t } = useTranslation();
  const { data, isLoading } = usePatientInvoices();
  const items = data?.items || (Array.isArray(data) ? data : []);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-950">{t('portal.billing.title', 'Billing')}</h1>
        <p className="text-sm text-muted-foreground">{t('portal.billing.description', 'Invoices, payments, and outstanding balance.')}</p>
      </div>
      <div className="space-y-2">
        {items.map((inv) => (
          <div key={inv.id} className="flex flex-col gap-2 rounded-xl border bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{inv.invoiceNumber}</p>
              <p className="text-sm text-muted-foreground">
                {t('portal.billing.total', 'Total')} ₹{inv.total} · {t('portal.billing.balance', 'Balance')} ₹{inv.balanceAmount} · {inv.paymentStatus}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const res = await patientPortalApi.invoicePrint(inv.id);
                  const blob = new Blob([JSON.stringify(res.data, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${inv.invoiceNumber || 'invoice'}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(t('portal.billing.downloadReady', 'Invoice download ready'));
                } catch (err) {
                  toast.error(err?.response?.data?.message || t('portal.billing.downloadFailed', 'Download failed'));
                }
              }}
            >
              {t('portal.billing.download', 'Download')}
            </Button>
          </div>
        ))}
        {!items.length && !isLoading && (
          <p className="text-sm text-muted-foreground">{t('portal.billing.empty', 'No invoices.')}</p>
        )}
      </div>
    </section>
  );
}
