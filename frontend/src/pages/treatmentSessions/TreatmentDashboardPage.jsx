import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSessionDashboard } from '@/modules/treatmentSessions/hooks/useTreatmentSessions';
import { SESSION_STATUS_LABELS } from '@/modules/treatmentSessions/constants';
import { APP_ROUTES, treatmentSessionPath } from '@/constants/routes';

export default function TreatmentDashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useSessionDashboard();
  const summary = data?.summary || {};
  const recent = data?.recent || [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('treatmentSessions.dashboard.heading', 'Treatment Execution')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'treatmentSessions.dashboard.subtitle',
              'Sessions from accepted plans — payment gated. No billing or inventory changes.'
            )}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={APP_ROUTES.TREATMENT_SESSIONS}>
            {t('treatmentSessions.dashboard.allSessions', 'All sessions')}
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [t('treatmentSessions.dashboard.scheduled', 'Scheduled'), summary.scheduled],
          [t('treatmentSessions.dashboard.inProgress', 'In progress'), summary.inProgress],
          [t('treatmentSessions.dashboard.completedToday', 'Completed today'), summary.completedToday],
          [t('treatmentSessions.dashboard.total', 'Total'), summary.total],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{isLoading ? '—' : value ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">{t('treatmentSessions.dashboard.recentSessions', 'Recent sessions')}</h2>
        {recent.map((s) => (
          <div
            key={s.id}
            className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <Activity className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">
                  {s.sessionNumber} · {s.patient?.fullName || t('treatmentSessions.dashboard.patient', 'Patient')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.treatmentPlan?.planNumber} · {t('treatmentSessions.dashboard.techPrefix', 'Tech')}{' '}
                  {s.technician?.fullName || '—'}
                </p>
              </div>
              <Badge>{SESSION_STATUS_LABELS[s.status] || s.status}</Badge>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to={treatmentSessionPath(s.id)}>{t('treatmentSessions.dashboard.open', 'Open')}</Link>
            </Button>
          </div>
        ))}
        {!recent.length && !isLoading && (
          <p className="text-sm text-muted-foreground">
            {t('treatmentSessions.dashboard.emptyState', 'No sessions yet.')}
          </p>
        )}
      </div>
    </section>
  );
}
