import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { treatmentPlansApi } from '@/modules/treatmentPlans/api/treatmentPlansApi';
import {
  APP_ROUTES,
  treatmentPlanEditPath,
} from '@/constants/routes';
import {
  TREATMENT_PLAN_STATUS_LABELS,
  CONSENT_TYPE_LABELS,
} from '@/modules/treatmentPlans/constants';

export default function TreatmentPlanPrintPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    treatmentPlansApi
      .print(id)
      .then((res) => setData(res.data))
      .catch((e) =>
        setError(
          e?.response?.data?.message ||
            t('treatmentPlans.print.loadFailed', 'Failed to load print data')
        )
      );
  }, [id]);

  const plan = data?.plan;

  if (error) {
    return <p className="p-6 text-sm text-destructive">{error}</p>;
  }
  if (!plan) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t('treatmentPlans.print.preparing', 'Preparing print…')}
      </p>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6 p-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link to={treatmentPlanEditPath(id)}>
            <ArrowLeft className="h-4 w-4" />
            {t('treatmentPlans.print.back', 'Back')}
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          {t('treatmentPlans.print.print', 'Print')}
        </Button>
      </div>

      <div className="space-y-6 rounded-xl border bg-white p-6 text-sm text-black">
        <header className="flex items-start justify-between border-b pb-4">
          <div>
            <div className="mb-2 flex h-12 w-24 items-center justify-center border border-dashed text-xs text-muted-foreground">
              {t('treatmentPlans.print.logoPlaceholder', 'LOGO')}
            </div>
            <h1 className="text-xl font-semibold">
              {t('treatmentPlans.print.title', 'Treatment Plan')}
            </h1>
            <p className="text-muted-foreground">
              {plan.branch?.name || t('treatmentPlans.print.clinicFallback', 'Clinic')}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold">{plan.planNumber}</p>
            <p>{TREATMENT_PLAN_STATUS_LABELS[plan.status]}</p>
            <div className="ml-auto mt-2 flex h-16 w-16 items-center justify-center border border-dashed text-[10px] text-muted-foreground">
              {t('treatmentPlans.print.qrPlaceholder', 'QR')}
            </div>
          </div>
        </header>

        <section className="grid gap-2 sm:grid-cols-2">
          <p>
            <span className="text-muted-foreground">
              {t('treatmentPlans.print.patient', 'Patient:')}
            </span>{' '}
            {plan.patient?.fullName}
          </p>
          <p>
            <span className="text-muted-foreground">
              {t('treatmentPlans.print.doctor', 'Doctor:')}
            </span>{' '}
            {plan.doctor?.name}
          </p>
          <p>
            <span className="text-muted-foreground">
              {t('treatmentPlans.print.consultation', 'Consultation:')}
            </span>{' '}
            {plan.consultation?.consultationNumber}
          </p>
          <p>
            <span className="text-muted-foreground">{t('treatmentPlans.print.title2', 'Title:')}</span>{' '}
            {plan.title}
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">
            {t('treatmentPlans.print.diagnosisGoals', 'Diagnosis & goals')}
          </h2>
          <p>{plan.diagnosisSummary || '—'}</p>
          <p className="mt-1">
            {t('treatmentPlans.print.clinicalGoal', 'Clinical goal:')} {plan.clinicalGoal || '—'}
          </p>
          <p>
            {t('treatmentPlans.print.expected', 'Expected:')} {plan.goals?.expectedResults || '—'}
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">
            {t('treatmentPlans.print.estimatedSessions', 'Estimated sessions')}
          </h2>
          <p>
            {t('treatmentPlans.print.sessionsDuration', {
              defaultValue: '{{sessions}} sessions · Duration {{duration}}',
              sessions: plan.estimatedSessions,
              duration: plan.estimatedDuration || '—',
            })}
          </p>
          <table className="mt-2 w-full border-collapse text-left">
            <thead>
              <tr className="border-b">
                <th className="py-1">{t('treatmentPlans.print.procedure', 'Procedure')}</th>
                <th className="py-1">{t('treatmentPlans.print.sessions', 'Sessions')}</th>
                <th className="py-1">{t('treatmentPlans.print.device', 'Device')}</th>
                <th className="py-1">{t('treatmentPlans.print.frequency', 'Frequency')}</th>
              </tr>
            </thead>
            <tbody>
              {(plan.items || []).map((it) => (
                <tr key={it.id || it.procedureName} className="border-b border-dashed">
                  <td className="py-1">{it.procedureName}</td>
                  <td className="py-1">{it.sessionCount}</td>
                  <td className="py-1">{it.deviceRequired || '—'}</td>
                  <td className="py-1">{it.frequency || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">
            {t('treatmentPlans.print.packageSummary', 'Package summary')}
          </h2>
          {plan.packageSnapshot ? (
            <p>
              {t('treatmentPlans.print.packageLine', {
                defaultValue:
                  '{{name}} — ₹{{price}} (discount ₹{{discount}}) · Max {{max}} · Unused {{unused}} · Validity {{validity}} days',
                name: plan.packageSnapshot.packageName,
                price: plan.packageSnapshot.packagePrice,
                discount: plan.packageSnapshot.discount || 0,
                max: plan.packageSnapshot.maximumSessions,
                unused: plan.packageSnapshot.unusedSessions,
                validity: plan.packageSnapshot.validityDays,
              })}
            </p>
          ) : (
            <p>—</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {t('treatmentPlans.print.pricingOnly', 'Pricing metadata only — no invoice.')}
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">{t('treatmentPlans.print.consent', 'Consent')}</h2>
          <ul className="list-disc pl-5">
            {(plan.consents || []).map((c) => (
              <li key={c.id}>
                {CONSENT_TYPE_LABELS[c.consentType] || c.consentType}: {c.status}
                {c.signedByName ? ` — ${c.signedByName}` : ''}
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-10 grid gap-8 sm:grid-cols-2">
          <div className="border-t pt-2">
            {t('treatmentPlans.print.doctorSignature', 'Doctor Signature')}
          </div>
          <div className="border-t pt-2">
            {t('treatmentPlans.print.patientSignature', 'Patient Signature')}
          </div>
        </footer>
      </div>

      <Link to={APP_ROUTES.TREATMENT_PLANS} className="text-sm underline print:hidden">
        {t('treatmentPlans.print.allPlans', 'All treatment plans')}
      </Link>
    </section>
  );
}
