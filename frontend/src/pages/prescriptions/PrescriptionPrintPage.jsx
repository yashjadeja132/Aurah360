import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { prescriptionsApi } from '@/modules/prescriptions/api/prescriptionsApi';
import { APP_ROUTES, prescriptionEditPath } from '@/constants/routes';

export default function PrescriptionPrintPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    prescriptionsApi
      .print(id)
      .then((res) => setData(res.data))
      .catch((e) => setError(e?.response?.data?.message || t('prescriptions.print.loadFailed', 'Failed to load print data')));
  }, [id]);

  const rx = data?.prescription;
  const meta = data?.printMeta;

  if (error) return <p className="p-6 text-sm text-destructive">{error}</p>;
  if (!rx) return <p className="p-6 text-sm text-muted-foreground">{t('prescriptions.print.preparing', 'Preparing print…')}</p>;

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to={prescriptionEditPath(id)}>
            <ArrowLeft className="h-4 w-4" />
            {t('prescriptions.print.backToEditor', 'Back to editor')}
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          {t('prescriptions.print.print', 'Print')}
        </Button>
      </div>

      <article className="rounded-xl border bg-white p-8 text-slate-900 shadow-sm print:border-0 print:shadow-none">
        <header className="mb-6 flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">
              {t('prescriptions.print.logo', 'LOGO')}
            </div>
            <h1 className="font-display text-2xl font-semibold">
              {rx.branch?.name || 'Aurah 360'}
            </h1>
            <p className="text-xs text-slate-500">
              {rx.branch?.branchCode || t('prescriptions.print.clinicFallback', 'Clinic')} · {t('prescriptions.print.tagline', 'Skin, Hair & Laser')}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{rx.prescriptionNumber}</p>
            <p className="text-slate-500">
              {rx.finalizedAt
                ? new Date(rx.finalizedAt).toLocaleDateString()
                : new Date(rx.createdAt).toLocaleDateString()}
            </p>
            <div className="ml-auto mt-2 flex h-14 w-14 items-center justify-center rounded border border-dashed border-slate-300 text-[10px] text-slate-400">
              {t('prescriptions.print.qr', 'QR')}
            </div>
          </div>
        </header>

        <div className="mb-6 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('prescriptions.print.patient', 'Patient')}</p>
            <p className="font-medium">{rx.patient?.fullName}</p>
            <p className="text-slate-600">{rx.patient?.mrn}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('prescriptions.print.doctor', 'Doctor')}</p>
            <p className="font-medium">{t('prescriptions.print.doctorPrefix', 'Dr.')} {rx.doctor?.name || '—'}</p>
            <p className="text-slate-600">{rx.doctor?.doctorCode}</p>
          </div>
        </div>

        <table className="mb-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <th className="py-2 pr-2">{t('prescriptions.print.medicine', 'Medicine')}</th>
              <th className="py-2 pr-2">{t('prescriptions.print.doseFreq', 'Dose / Freq')}</th>
              <th className="py-2 pr-2">{t('prescriptions.print.duration', 'Duration')}</th>
              <th className="py-2">{t('prescriptions.print.timing', 'Timing')}</th>
            </tr>
          </thead>
          <tbody>
            {(rx.items || []).map((it, idx) => (
              <tr key={it.id || idx} className="border-b border-slate-100 align-top">
                <td className="py-3 pr-2">
                  <p className="font-medium">{it.medicineName}</p>
                  <p className="text-xs text-slate-500">
                    {[it.genericName, it.strength, it.route].filter(Boolean).join(' · ')}
                  </p>
                  {it.instructions && (
                    <p className="mt-1 text-xs text-slate-600">{it.instructions}</p>
                  )}
                </td>
                <td className="py-3 pr-2">
                  {it.dosage || '—'}
                  <br />
                  <span className="text-xs text-slate-500">{it.frequency || '—'}</span>
                </td>
                <td className="py-3 pr-2">{it.duration || '—'}</td>
                <td className="py-3 text-xs text-slate-600">
                  {[
                    it.morning && t('prescriptions.print.morning', 'Morning'),
                    it.afternoon && t('prescriptions.print.afternoon', 'Afternoon'),
                    it.night && t('prescriptions.print.night', 'Night'),
                    it.beforeFood && t('prescriptions.print.beforeFood', 'Before food'),
                    it.afterFood && t('prescriptions.print.afterFood', 'After food'),
                  ]
                    .filter(Boolean)
                    .join(', ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rx.notes && (
          <p className="mb-8 text-sm">
            <span className="font-medium">{t('prescriptions.print.notesLabel', 'Notes: ')}</span>
            {rx.notes}
          </p>
        )}

        <footer className="mt-12 flex items-end justify-between">
          <p className="text-xs text-slate-400">
            {t('prescriptions.print.statusLabel', 'Status:')} {rx.status}
            {meta?.printedAt ? ` · ${t('prescriptions.print.printedLabel', 'Printed')} ${new Date(meta.printedAt).toLocaleString()}` : ''}
          </p>
          <div className="w-48 border-t border-slate-400 pt-2 text-center text-sm">
            {meta?.signatureLabel || t('prescriptions.print.doctorSignature', 'Doctor Signature')}
            <p className="mt-1 text-xs text-slate-500">{t('prescriptions.print.doctorPrefix', 'Dr.')} {rx.doctor?.name || '—'}</p>
          </div>
        </footer>
      </article>

      <p className="text-center text-xs text-muted-foreground print:hidden">
        <Link to={APP_ROUTES.PRESCRIPTIONS} className="underline">
          {t('prescriptions.print.allPrescriptions', 'All prescriptions')}
        </Link>
      </p>
    </section>
  );
}
