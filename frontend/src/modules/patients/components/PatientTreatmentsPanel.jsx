import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { usePatientTreatmentPlans } from '@/modules/treatmentPlans/hooks/useTreatmentPlans';
import { usePlanProgress } from '@/modules/treatmentSessions/hooks/useTreatmentSessions';
import { TREATMENT_PLAN_STATUS_LABELS } from '@/modules/treatmentPlans/constants';
import { SESSION_STATUS_LABELS } from '@/modules/treatmentSessions/constants';
import { treatmentPlanEditPath, treatmentSessionPath } from '@/constants/routes';

const PLAN_STATUS_VARIANT = {
  DRAFT: 'outline',
  RECOMMENDED: 'warning',
  APPROVED: 'warning',
  ACCEPTED: 'success',
  COMPLETED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'destructive',
};

const SESSION_STATUS_VARIANT = {
  SCHEDULED: 'outline',
  CHECKED_IN: 'warning',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
  SKIPPED: 'destructive',
};

/**
 * Treatment plans + their sessions inside the 360° patient profile. Each plan is summarised the
 * way a clinician reads it — progress against the plan first, then the sessions that produced it —
 * rather than as two disconnected lists.
 */
export function PatientTreatmentsPanel({ patientId }) {
  const { t } = useTranslation();
  const { data: plans = [], isLoading } = usePatientTreatmentPlans(patientId);

  if (isLoading) return <Skeleton className="h-60 w-full" />;

  if (!plans.length) {
    return (
      <EmptyState
        icon={Activity}
        title={t('patients.detail.treatments.emptyTitle', 'No treatment plans')}
        description={t(
          'patients.detail.treatments.emptyDescription',
          'This patient has no treatment plans yet.'
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}

function PlanCard({ plan }) {
  const { t } = useTranslation();
  const { data: progress, isLoading } = usePlanProgress(plan.id);

  const total = progress?.totalSessions ?? plan.estimatedSessions ?? 0;
  const used = progress?.usedSessions ?? 0;
  const completed = progress?.completedSessions ?? 0;
  const remaining = progress?.remainingSessions ?? Math.max(total - used, 0);
  const percent = progress?.completionPercent ?? 0;
  const sessions = progress?.sessions || [];

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {plan.title || plan.planNumber}
            <Badge variant={PLAN_STATUS_VARIANT[plan.status] || 'outline'}>
              {TREATMENT_PLAN_STATUS_LABELS[plan.status] || plan.status}
            </Badge>
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {[
              plan.planNumber,
              plan.category,
              plan.doctor?.name,
              plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={treatmentPlanEditPath(plan.id)}>
            {t('patients.detail.treatments.openPlan', 'Open plan')}
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">
                  {t('patients.detail.treatments.sessionsUsed', '{{used}} of {{total}} sessions used', {
                    used,
                    total,
                  })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('patients.detail.treatments.completedCount', '{{count}} completed', {
                    count: completed,
                  })}
                  {' · '}
                  {t('patients.detail.treatments.remainingCount', '{{count}} remaining', {
                    count: remaining,
                  })}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('patients.detail.treatments.percentComplete', '{{percent}}% complete', {
                  percent,
                })}
                {progress?.expectedEndDate &&
                  ` · ${t('patients.detail.treatments.expectedEnd', 'Expected end {{date}}', {
                    date: new Date(progress.expectedEndDate).toLocaleDateString(),
                  })}`}
              </p>
            </div>

            {sessions.length ? (
              <ul className="divide-y rounded-lg border">
                {sessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{s.sessionNumber}</span>{' '}
                      <span className="text-xs text-muted-foreground">
                        {t('patients.detail.treatments.sessionIndex', 'Session {{index}}', {
                          index: s.sessionIndex,
                        })}
                        {' · '}
                        {s.completedAt
                          ? t('patients.detail.treatments.completedOn', 'Completed {{date}}', {
                              date: new Date(s.completedAt).toLocaleDateString(),
                            })
                          : t('patients.detail.treatments.scheduledOn', 'Scheduled {{date}}', {
                              date: s.scheduledDate
                                ? new Date(s.scheduledDate).toLocaleDateString()
                                : '—',
                            })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={SESSION_STATUS_VARIANT[s.status] || 'outline'}>
                        {SESSION_STATUS_LABELS[s.status] || s.status}
                      </Badge>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={treatmentSessionPath(s.id)}>
                          {t('patients.detail.treatments.openSession', 'Open')}
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('patients.detail.treatments.noSessions', 'No sessions scheduled for this plan yet.')}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default PatientTreatmentsPanel;
