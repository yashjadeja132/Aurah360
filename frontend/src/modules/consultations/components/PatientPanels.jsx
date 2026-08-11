import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ConsultationStatusBadge } from './StatusBadges';
import { APP_ROUTES } from '@/constants/routes';

export function PatientSummarySidebar({ summary, loading }) {
  const { t } = useTranslation();

  if (loading) {
    return <p className="p-4 text-sm text-muted-foreground">{t('consultations.patientPanels.loadingPatient', 'Loading patient…')}</p>;
  }
  if (!summary?.patient) {
    return <p className="p-4 text-sm text-muted-foreground">{t('consultations.patientPanels.noPatientSelected', 'No patient selected.')}</p>;
  }

  const p = summary.patient;

  return (
    <aside className="space-y-4 p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('consultations.patientPanels.patient', 'Patient')}
        </p>
        <h2 className="font-display text-xl font-semibold text-primary">
          {[p.firstName, p.lastName].filter(Boolean).join(' ')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {p.mrn} · {p.mobile || '—'}
        </p>
      </div>

      <Section title={t('consultations.patientPanels.allergies', 'Allergies')}>
        <p className="text-sm">{summary.allergies || t('consultations.patientPanels.noneRecorded', 'None recorded')}</p>
      </Section>

      <Section title={t('consultations.patientPanels.medicalHistory', 'Medical history')}>
        <p className="text-sm whitespace-pre-wrap">{summary.medicalHistory || '—'}</p>
      </Section>

      <Section title={t('consultations.patientPanels.currentMedicines', 'Current medicines')}>
        <p className="text-sm whitespace-pre-wrap">{summary.currentMedicines || '—'}</p>
      </Section>

      <Section title={t('consultations.patientPanels.previousTreatments', 'Previous treatments')}>
        <p className="text-sm text-muted-foreground">
          {summary.previousTreatments?.length
            ? summary.previousTreatments.join(', ')
            : t('consultations.patientPanels.noneYetTreatment', 'None yet (Treatment module later)')}
        </p>
      </Section>

      <Section title={t('consultations.patientPanels.previousPrescriptions', 'Previous prescriptions')}>
        <p className="text-sm text-muted-foreground">
          {summary.previousPrescriptions?.length
            ? summary.previousPrescriptions.join(', ')
            : t('consultations.patientPanels.noneYetPrescription', 'None yet (Prescription module later)')}
        </p>
      </Section>

      <Section title={t('consultations.patientPanels.previousConsultations', 'Previous consultations')}>
        <ul className="space-y-2">
          {(summary.previousConsultations || []).slice(0, 8).map((c) => (
            <li key={c.id} className="rounded-md border px-2 py-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.consultationNumber}</span>
                <ConsultationStatusBadge status={c.status} />
              </div>
              <p className="mt-0.5 text-muted-foreground">
                {c.startedAt ? new Date(c.startedAt).toLocaleDateString() : '—'}
              </p>
            </li>
          ))}
          {!summary.previousConsultations?.length && (
            <li className="text-sm text-muted-foreground">
              {t('consultations.patientPanels.noPriorConsultations', 'No prior consultations')}
            </li>
          )}
        </ul>
      </Section>
    </aside>
  );
}

export function TimelinePanel({ summary, loading }) {
  const { t } = useTranslation();
  const timeline = summary?.timeline || [];
  const previous = summary?.previousConsultations || [];
  const patientId = summary?.patient?.id;

  return (
    <aside className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{t('consultations.patientPanels.timeline', 'Timeline')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('consultations.patientPanels.timelineSubtitle', 'Patient events & visits')}
          </p>
        </div>
        {patientId && (
          <Link
            to={`${APP_ROUTES.TREATMENT_SAFETY}?patientId=${patientId}`}
            className="whitespace-nowrap text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            {t('consultations.patientPanels.treatmentHistory', 'Treatment & safety history →')}
          </Link>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>}

      <ul className="space-y-2">
        {timeline.slice(0, 20).map((ev) => (
          <li key={ev.id || `${ev.eventType}-${ev.occurredAt}`} className="border-l-2 border-primary/40 pl-3">
            <p className="text-sm font-medium">{ev.title}</p>
            <p className="text-xs text-muted-foreground">
              {ev.eventType} ·{' '}
              {ev.occurredAt ? new Date(ev.occurredAt).toLocaleString() : '—'}
            </p>
          </li>
        ))}
        {!timeline.length && !loading && (
          <li className="text-sm text-muted-foreground">
            {t('consultations.patientPanels.noTimelineEvents', 'No timeline events')}
          </li>
        )}
      </ul>

      <div>
        <h3 className="mb-2 font-semibold">{t('consultations.patientPanels.previousVisits', 'Previous visits')}</h3>
        <ul className="space-y-2">
          {previous.map((c) => (
            <li key={c.id} className="rounded-md bg-muted/50 px-2 py-2 text-xs">
              <p className="font-medium">{c.consultationNumber}</p>
              <p className="text-muted-foreground">
                {t('consultations.workspace.doctorPrefix', 'Dr.')} {c.doctor?.name || '—'} · {c.status}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-1 border-t border-border/60 pt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
