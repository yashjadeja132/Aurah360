import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { usePatientPrescriptions } from '@/modules/patientPortal/hooks/usePatientPortal';
import { patientPortalApi } from '@/modules/patientPortal/api/patientApi';

export default function PatientPrescriptionsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = usePatientPrescriptions();
  const items = Array.isArray(data) ? data : data?.items || [];

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-950">{t('portal.prescriptions.title', 'Prescriptions')}</h1>
        <p className="text-sm text-muted-foreground">{t('portal.prescriptions.subtitle', 'View medicines and print/download summary.')}</p>
      </div>
      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 rounded-xl border bg-white/80 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{p.prescriptionNumber}</p>
              <p className="text-sm text-muted-foreground">{p.status}</p>
              <ul className="mt-1 text-xs text-muted-foreground">
                {(p.items || []).slice(0, 4).map((i, idx) => (
                  <li key={idx}>{i.medicineName || i.name} — {i.instructions || i.dosage || ''}</li>
                ))}
              </ul>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const res = await patientPortalApi.prescriptionPrint(p.id);
                  const blob = new Blob([JSON.stringify(res.data, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${p.prescriptionNumber || 'prescription'}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success(t('portal.prescriptions.downloadReady', 'Download ready (print data)'));
                } catch (err) {
                  toast.error(err?.response?.data?.message || t('portal.prescriptions.downloadFailed', 'Download failed'));
                }
              }}
            >
              {t('portal.prescriptions.download', 'Download')}
            </Button>
          </div>
        ))}
        {!items.length && !isLoading && (
          <p className="text-sm text-muted-foreground">{t('portal.prescriptions.empty', 'No prescriptions.')}</p>
        )}
      </div>
    </section>
  );
}
