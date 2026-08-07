import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePatientConsultations, usePatientTimeline } from '@/modules/patientPortal/hooks/usePatientPortal';
import { patientPortalApi } from '@/modules/patientPortal/api/patientApi';
import { Button } from '@/components/ui/button';

export default function PatientRecordsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = usePatientConsultations();
  const { data: timeline } = usePatientTimeline();
  const items = Array.isArray(data) ? data : data?.items || [];
  const [detail, setDetail] = useState(null);

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-950">{t('portal.records.title', 'Medical records')}</h1>
        <p className="text-sm text-muted-foreground">{t('portal.records.subtitle', 'Read-only consultations, vitals, and timeline.')}</p>
      </div>

      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.id || c._id} className="rounded-xl border bg-white/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{c.consultationNumber || c.id}</p>
                <p className="text-sm text-muted-foreground">{c.status}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  const res = await patientPortalApi.consultation(c.id || c._id);
                  setDetail(res.data);
                }}
              >
                {t('portal.records.view', 'View')}
              </Button>
            </div>
          </div>
        ))}
        {!items.length && !isLoading && (
          <p className="text-sm text-muted-foreground">{t('portal.records.empty', 'No consultations yet.')}</p>
        )}
      </div>

      {detail && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="font-semibold">{t('portal.records.detailTitle', 'Consultation detail')}</h2>
          <pre className="mt-2 max-h-80 overflow-auto text-xs text-muted-foreground">
            {JSON.stringify(detail, null, 2)}
          </pre>
        </div>
      )}

      <div>
        <h2 className="mb-2 font-semibold">{t('portal.records.timeline', 'Timeline')}</h2>
        <ul className="space-y-2">
          {(Array.isArray(timeline) ? timeline : timeline?.items || []).slice(0, 20).map((e, i) => (
            <li key={e.id || i} className="rounded-lg border bg-white/70 px-3 py-2 text-sm">
              <span className="font-medium">{e.title || e.eventType}</span>
              <span className="ml-2 text-muted-foreground">
                {e.createdAt ? new Date(e.createdAt).toLocaleString() : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
