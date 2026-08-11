import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { useStartConsultation } from '@/modules/consultations/hooks/useConsultations';
import { IntakeForm } from '@/modules/consultations/components/IntakeForm';
import { APP_ROUTES } from '@/constants/routes';

/**
 * §2 Pre-consult intake — the nurse's dedicated entry point, reached from the "Start intake"
 * action on the queue (NurseTodayPage). Keyed by appointmentId rather than a consultationId
 * because none may exist yet: `consultationsApi.start()` (via useStartConsultation) is the same
 * idempotent call the doctor's "Start from appointment" flow uses — ConsultationService#start
 * returns the existing workspace if one is already there for this appointment, so a nurse
 * starting intake first and the doctor opening the encounter later share one record, never two.
 */
export default function NurseIntakePage() {
  const { t } = useTranslation();
  const { appointmentId } = useParams();
  const startedFor = useRef(null);
  const start = useStartConsultation();

  useEffect(() => {
    if (!appointmentId || startedFor.current === appointmentId) return;
    startedFor.current = appointmentId;
    start.mutate({ appointmentId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  const consultationId = start.data?.consultation?.id;

  return (
    <section className="space-y-4">
      <PageHeader
        icon={ClipboardList}
        title={t('nurse.intake.title', 'Pre-consult intake')}
        description={t(
          'nurse.intake.subtitle',
          'Confirm chief complaint, history and skin/hair/laser background before the doctor opens the encounter.'
        )}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to={APP_ROUTES.NURSE_TODAY}>
              <ArrowLeft className="h-4 w-4" />
              {t('common.back', 'Back to queue')}
            </Link>
          </Button>
        }
      />

      {start.isPending && (
        <p className="text-sm text-muted-foreground">{t('nurse.intake.starting', 'Opening patient record…')}</p>
      )}
      {start.isError && (
        <p className="text-sm text-destructive">
          {start.error?.response?.data?.message || t('nurse.intake.startFailed', 'Could not open this patient record')}
        </p>
      )}
      {consultationId && (
        <div className="rounded-xl border bg-card p-4">
          <IntakeForm consultationId={consultationId} readOnly={false} />
        </div>
      )}
    </section>
  );
}
