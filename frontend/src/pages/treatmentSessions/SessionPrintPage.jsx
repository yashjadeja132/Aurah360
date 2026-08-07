import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { treatmentSessionsApi } from '@/modules/treatmentSessions/api/treatmentSessionsApi';
import { APP_ROUTES, treatmentSessionPath } from '@/constants/routes';
import { SESSION_STATUS_LABELS } from '@/modules/treatmentSessions/constants';

export default function SessionPrintPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    treatmentSessionsApi
      .print(id)
      .then((res) => setData(res.data))
      .catch((e) =>
        setError(e?.response?.data?.message || t('treatmentSessions.print.failedToLoad', 'Failed to load'))
      );
  }, [id, t]);

  const session = data?.session;
  const progress = data?.progress || session?.progress;

  if (error) return <p className="p-6 text-sm text-destructive">{error}</p>;
  if (!session)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t('treatmentSessions.print.preparingPrint', 'Preparing print…')}
      </p>
    );

  return (
    <section className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to={treatmentSessionPath(id)}>
            <ArrowLeft className="h-4 w-4" />
            {t('treatmentSessions.print.back', 'Back')}
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          {t('treatmentSessions.print.print', 'Print')}
        </Button>
      </div>

      <div className="space-y-6 rounded-xl border bg-white p-6 text-sm text-black">
        <header className="flex justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold">{t('treatmentSessions.print.treatmentSummary', 'Treatment Summary')}</h1>
            <p>{session.branch?.name || t('treatmentSessions.print.clinic', 'Clinic')}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{session.sessionNumber}</p>
            <p>{SESSION_STATUS_LABELS[session.status]}</p>
            <div className="ml-auto mt-2 flex h-14 w-14 items-center justify-center border border-dashed text-[10px]">
              {t('treatmentSessions.print.qr', 'QR')}
            </div>
          </div>
        </header>

        <section className="grid gap-2 sm:grid-cols-2">
          <p>
            {t('treatmentSessions.print.patient', 'Patient')}: {session.patient?.fullName}
          </p>
          <p>
            {t('treatmentSessions.print.doctor', 'Doctor')}: {session.doctor?.name}
          </p>
          <p>
            {t('treatmentSessions.print.technician', 'Technician')}: {session.technician?.fullName || '—'}
          </p>
          <p>
            {t('treatmentSessions.print.plan', 'Plan')}: {session.treatmentPlan?.planNumber}
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">{t('treatmentSessions.print.planProgress', 'Plan progress')}</h2>
          <p>
            {progress?.completedSessions}/{progress?.totalSessions} {t('treatmentSessions.print.completed', 'completed')} (
            {progress?.completionPercent}
            %) · {t('treatmentSessions.print.remaining', 'Remaining')} {progress?.remainingSessions}
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">{t('treatmentSessions.print.sessionHistory', 'Session history')}</h2>
          <ul className="list-disc pl-5">
            {(progress?.sessions || []).map((s) => (
              <li key={s.id}>
                {s.sessionNumber} — {SESSION_STATUS_LABELS[s.status]}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">{t('treatmentSessions.print.thisSession', 'This session')}</h2>
          <p>
            {t('treatmentSessions.print.device', 'Device')}: {session.deviceUsage?.device || '—'}
          </p>
          <p>
            {t('treatmentSessions.print.machine', 'Machine')}: {session.deviceUsage?.machine || '—'}
          </p>
          <p>
            {t('treatmentSessions.print.outcome', 'Outcome')}: {session.outcome || '—'}
          </p>
          <p>
            {t('treatmentSessions.print.complications', 'Complications')}:{' '}
            {session.complications || t('treatmentSessions.print.none', 'None')}
          </p>
        </section>
      </div>

      <Link to={APP_ROUTES.TREATMENT_DASHBOARD} className="text-sm underline print:hidden">
        {t('treatmentSessions.print.dashboard', 'Dashboard')}
      </Link>
    </section>
  );
}
