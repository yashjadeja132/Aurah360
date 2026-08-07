import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PORTAL_ROUTES } from '@/constants/routes';
import { usePatientAuth } from '@/contexts/PatientAuthContext';
import { usePatientDashboard } from '@/modules/patientPortal/hooks/usePatientPortal';

function Card({ title, children, to }) {
  const body = (
    <div className="rounded-xl border bg-white/80 p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-teal-950">{title}</h2>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function PatientDashboardPage() {
  const { t } = useTranslation();
  const { patient } = usePatientAuth();
  const { data, isLoading } = usePatientDashboard();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-950">
          {patient?.firstName
            ? t('portal.dashboard.greetingWithName', 'Hello, {{name}}', { name: patient.firstName })
            : t('portal.dashboard.greeting', 'Hello')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('portal.dashboard.subtitle', 'Your care overview')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title={t('portal.dashboard.upcomingAppointment', 'Upcoming appointment')} to={PORTAL_ROUTES.APPOINTMENTS}>
          {isLoading
            ? '…'
            : data?.upcomingAppointment
              ? `${new Date(data.upcomingAppointment.appointmentDate).toLocaleDateString()} · ${data.upcomingAppointment.startTime}`
              : t('portal.dashboard.noneScheduled', 'None scheduled')}
        </Card>
        <Card title={t('portal.dashboard.todaysTreatments', "Today's treatments")} to={PORTAL_ROUTES.TREATMENTS}>
          {isLoading ? '…' : t('portal.dashboard.sessionsCount', '{{count}} session(s)', { count: data?.todaysTreatments?.length || 0 })}
        </Card>
        <Card title={t('portal.dashboard.outstanding', 'Outstanding')} to={PORTAL_ROUTES.BILLING}>
          {isLoading ? '…' : `₹${data?.outstandingBalance ?? 0}`}
        </Card>
        <Card title={t('portal.dashboard.alerts', 'Alerts')} to={PORTAL_ROUTES.NOTIFICATIONS}>
          {isLoading ? '…' : t('portal.dashboard.unreadCount', '{{count}} unread', { count: data?.notifications?.filter((n) => !n.isRead).length || 0 })}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t('portal.dashboard.prescriptionSummary', 'Prescription summary')} to={PORTAL_ROUTES.PRESCRIPTIONS}>
          <ul className="space-y-1">
            {(data?.prescriptionSummary || []).map((p) => (
              <li key={p.id}>{p.prescriptionNumber} · {p.status}</li>
            ))}
            {!data?.prescriptionSummary?.length && !isLoading && <li>{t('portal.dashboard.noPrescriptions', 'No prescriptions yet.')}</li>}
          </ul>
        </Card>
        <Card title={t('portal.dashboard.treatmentProgress', 'Treatment progress')} to={PORTAL_ROUTES.TREATMENTS}>
          <ul className="space-y-1">
            {(data?.treatmentProgress || []).map((p) => (
              <li key={p.planId}>
                {t('portal.dashboard.plan', 'Plan')} {String(p.planId).slice(-6)} · {p.completedSessions ?? p.completed ?? 0}/
                {p.totalSessions ?? p.total ?? '?'} {t('portal.dashboard.done', 'done')}
              </li>
            ))}
            {!data?.treatmentProgress?.length && !isLoading && <li>{t('portal.dashboard.noActivePlans', 'No active plans.')}</li>}
          </ul>
        </Card>
        <Card title={t('portal.dashboard.recentConsultation', 'Recent consultation')} to={PORTAL_ROUTES.RECORDS}>
          {data?.recentConsultation?.consultationNumber ||
            data?.recentConsultation?.status ||
            t('portal.dashboard.none', 'None')}
        </Card>
        <Card title={t('portal.dashboard.documents', 'Documents')} to={PORTAL_ROUTES.DOCUMENTS}>
          {t('portal.dashboard.filesCount', '{{count}} file(s)', { count: data?.documents?.length || 0 })}
        </Card>
      </div>
    </section>
  );
}
