import { useTranslation } from 'react-i18next';
import { AlertTriangle, Activity, History, Stethoscope } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePatientContext } from '../hooks/useDoctorDay';

const FLAG_LABELS = {
  allergies: ['doctorDay.flags.allergies', 'Allergies'],
  chronicDiseases: ['doctorDay.flags.chronicDiseases', 'Chronic conditions'],
  currentMedicines: ['doctorDay.flags.currentMedicines', 'Current medicines'],
  medicalHistory: ['doctorDay.flags.medicalHistory', 'Medical history'],
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </p>
      {children}
    </div>
  );
}

/**
 * A1 — the in-place expansion for one upcoming appointment. Mounted only when the row
 * is open, so all of its queries (patient summary, latest-visit diagnosis, plan
 * progress) fire lazily on expand rather than for every row on page load.
 */
export function PatientContextPanel({ patientId }) {
  const { t } = useTranslation();
  const ctx = usePatientContext(patientId);

  if (ctx.isLoading) {
    return (
      <div className="space-y-2 px-4 pb-4">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (ctx.isError) {
    return (
      <p className="px-4 pb-4 text-sm text-destructive">
        {ctx.error?.response?.data?.message ||
          t('doctorDay.contextError', 'Could not load this patient’s history.')}
      </p>
    );
  }

  const { diagnosis, soap, activePlan, progress, safetyFlags, consultations } = ctx;
  const prior = consultations.slice(0, 5);

  return (
    <div className="space-y-5 border-t bg-muted/20 px-4 py-4">
      {/* Safety first — this is what changes the doctor's next action. */}
      {safetyFlags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {safetyFlags.map((flag) => {
            const [key, def] = FLAG_LABELS[flag.key] || [flag.key, flag.key];
            return (
              <Badge
                key={flag.key}
                variant={flag.critical ? 'destructive' : 'warning'}
                className="max-w-full whitespace-normal text-left"
              >
                {flag.critical && <AlertTriangle className="h-3 w-3 shrink-0" />}
                <span className="font-semibold">{t(key, def)}:</span> {flag.value}
              </Badge>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t('doctorDay.noSafetyFlags', 'No allergies or safety flags recorded.')}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Section
          icon={Stethoscope}
          title={t('doctorDay.lastAssessment', 'Last diagnosis & assessment')}
        >
          {diagnosis || soap ? (
            <div className="space-y-1 text-sm">
              {diagnosis?.primaryDiagnosis && (
                <p className="font-medium text-foreground">{diagnosis.primaryDiagnosis}</p>
              )}
              {diagnosis?.icd10Codes?.length > 0 && (
                <p className="text-xs text-muted-foreground">{diagnosis.icd10Codes.join(', ')}</p>
              )}
              {soap?.assessment && <p className="text-muted-foreground">{soap.assessment}</p>}
              {soap?.plan && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t('doctorDay.planLabel', 'Plan')}:
                  </span>{' '}
                  {soap.plan}
                </p>
              )}
              {ctx.latestConsultation?.followUp?.reason && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t('doctorDay.followUpLabel', 'Follow-up')}:
                  </span>{' '}
                  {ctx.latestConsultation.followUp.reason}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('doctorDay.noAssessment', 'No signed assessment yet — this is a first read.')}
            </p>
          )}
        </Section>

        <Section icon={Activity} title={t('doctorDay.treatmentProgress', 'Treatment progress')}>
          {activePlan ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">
                {activePlan.title}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  {activePlan.planNumber}
                </span>
              </p>
              <Badge variant="secondary">{activePlan.status}</Badge>
              {progress ? (
                <>
                  <p className="text-muted-foreground">
                    {t('doctorDay.sessionsUsed', '{{used}} of {{total}} sessions used', {
                      used: progress.usedSessions ?? 0,
                      total: progress.totalSessions ?? 0,
                    })}
                    {' · '}
                    {t('doctorDay.sessionsCompleted', '{{count}} completed', {
                      count: progress.completedSessions ?? 0,
                    })}
                  </p>
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={progress.completionPercent ?? 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(progress.completionPercent ?? 0, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('doctorDay.sessionsRemaining', '{{count}} remaining', {
                      count: progress.remainingSessions ?? 0,
                    })}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('doctorDay.noSessions', 'No sessions scheduled against this plan yet.')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('doctorDay.noPlan', 'No active treatment plan.')}
            </p>
          )}
        </Section>

        <Section icon={History} title={t('doctorDay.previousVisits', 'Previous visits')}>
          {prior.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {prior.map((c) => (
                <li key={c.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-foreground">
                    {formatDate(c.startedAt || c.createdAt)}
                  </span>
                  <span className="text-xs text-muted-foreground">{c.status}</span>
                  {c.chiefComplaint && (
                    <span className="block w-full text-xs text-muted-foreground">
                      {c.chiefComplaint}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('doctorDay.noPreviousVisits', 'No previous visits on record.')}
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}

export default PatientContextPanel;
