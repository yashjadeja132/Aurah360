import { usePatientPlans } from '@/modules/patientPortal/hooks/usePatientPortal';
import { patientPortalApi } from '@/modules/patientPortal/api/patientApi';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export default function PatientTreatmentsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = usePatientPlans();
  const items = Array.isArray(data) ? data : data?.items || [];
  const [detail, setDetail] = useState(null);

  return (
    <section className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-950">{t('portal.treatments.title', 'Treatment progress')}</h1>
        <p className="text-sm text-muted-foreground">{t('portal.treatments.subtitle', 'Plans, sessions remaining, and package summary.')}</p>
      </div>
      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id} className="rounded-xl border bg-white/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{p.planNumber || p.id}</p>
                <p className="text-sm text-muted-foreground">{p.status}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  const res = await patientPortalApi.treatmentPlan(p.id);
                  setDetail(res.data);
                }}
              >
                {t('portal.treatments.progress', 'Progress')}
              </Button>
            </div>
          </div>
        ))}
        {!items.length && !isLoading && (
          <p className="text-sm text-muted-foreground">{t('portal.treatments.empty', 'No treatment plans.')}</p>
        )}
      </div>
      {detail && (
        <div className="rounded-xl border bg-white p-4 text-sm">
          <p>
            {t('portal.treatments.completed', 'Completed')}: {detail.progress?.completedSessions ?? detail.progress?.completed ?? '—'} /{' '}
            {detail.progress?.totalSessions ?? detail.progress?.total ?? '—'}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t('portal.treatments.remaining', 'Remaining')}: {detail.progress?.remainingSessions ?? detail.progress?.remaining ?? '—'}
          </p>
        </div>
      )}
    </section>
  );
}
