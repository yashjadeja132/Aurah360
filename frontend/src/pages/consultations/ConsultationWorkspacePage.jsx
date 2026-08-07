import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, PenLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { cn } from '@/utils/cn';
import {
  useConsultationWorkspace,
  usePatientConsultationSummary,
  useSignConsultation,
  useLockConsultation,
  useUpdateConsultation,
} from '@/modules/consultations/hooks/useConsultations';
import { SoapEditor } from '@/modules/consultations/components/SoapEditor';
import { VitalsForm } from '@/modules/consultations/components/VitalsForm';
import {
  DiagnosisForm,
  ExaminationForm,
} from '@/modules/consultations/components/DiagnosisExamForms';
import { ClinicalPhotosPanel } from '@/modules/consultations/components/ClinicalPhotosPanel';
import { AiAssistPanel } from '@/modules/consultations/components/AiAssistPanel';
import {
  PatientSummarySidebar,
  TimelinePanel,
} from '@/modules/consultations/components/PatientPanels';
import {
  ConsultationStatusBadge,
} from '@/modules/consultations/components/StatusBadges';
import { FOLLOW_UP_UNITS, WORKSPACE_TABS } from '@/modules/consultations/constants';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { useAuth } from '@/contexts/AuthContext';

export default function ConsultationWorkspacePage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useConsultationWorkspace(id);
  const consultation = data?.consultation;
  const patientId = consultation?.patientId;
  const summaryQuery = usePatientConsultationSummary(patientId);
  const [tab, setTab] = useState('soap');

  const sign = useSignConsultation(id);
  const lock = useLockConsultation(id);
  const update = useUpdateConsultation(id);

  const readOnly = useMemo(() => {
    if (!consultation) return true;
    return (
      consultation.locked ||
      consultation.status === 'SIGNED' ||
      consultation.status === 'LOCKED'
    );
  }, [consultation]);

  const [followUp, setFollowUp] = useState({
    value: '',
    unit: 'WEEKS',
    reason: '',
    instructions: '',
  });

  useEffect(() => {
    if (consultation?.followUp) {
      setFollowUp({
        value: consultation.followUp.value ?? '',
        unit: consultation.followUp.unit || 'WEEKS',
        reason: consultation.followUp.reason || '',
        instructions: consultation.followUp.instructions || '',
      });
    }
  }, [consultation?.id]);

  const tabLabel = (tabId) => t(`consultations.tabs.${tabId}`, WORKSPACE_TABS.find((w) => w.id === tabId)?.label || tabId);
  const followUpUnitLabel = (unit) => t(`consultations.followUp.units.${unit}`, FOLLOW_UP_UNITS.find((u) => u.value === unit)?.label || unit);

  if (isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">{t('consultations.workspace.loading', 'Loading workspace…')}</p>;
  }
  if (isError || !consultation) {
    return (
      <p className="p-6 text-sm text-destructive">
        {error?.response?.data?.message || t('consultations.workspace.notFound', 'Consultation not found')}
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link to={APP_ROUTES.CONSULTATIONS}>
              <ArrowLeft className="h-4 w-4" />
              {t('common.back', 'Back')}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-primary">
              {consultation.consultationNumber}
            </h1>
            <ConsultationStatusBadge status={consultation.status} />
            {readOnly && (
              <span className="text-xs font-medium text-muted-foreground">
                {t('consultations.workspace.immutable', 'Immutable')}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {consultation.patient?.fullName} · {t('consultations.workspace.doctorPrefix', 'Dr.')} {consultation.doctor?.name || '—'} ·{' '}
            {consultation.appointment?.appointmentNumber}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <PermissionGuard permissions={[PERMISSIONS.CONSULTATION_SIGN, PERMISSIONS.CONSULTATION_ALL]}>
              <Button onClick={() => sign.mutate()} disabled={sign.isPending}>
                <PenLine className="h-4 w-4" />
                {t('consultations.workspace.sign', 'Sign')}
              </Button>
            </PermissionGuard>
          )}
          {consultation.status === 'SIGNED' && !consultation.locked && (
            <PermissionGuard permissions={[PERMISSIONS.CONSULTATION_LOCK, PERMISSIONS.CONSULTATION_ALL]}>
              <Button variant="outline" onClick={() => lock.mutate()} disabled={lock.isPending}>
                <Lock className="h-4 w-4" />
                {t('consultations.workspace.lock', 'Lock')}
              </Button>
            </PermissionGuard>
          )}
          <PermissionGuard permissions={[PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL]}>
            <Button asChild variant="outline">
              <Link to={`${APP_ROUTES.PRESCRIPTIONS}?consultationId=${consultation.id}`}>
                {t('nav.prescriptions', 'Prescriptions')}
              </Link>
            </Button>
          </PermissionGuard>
          <PermissionGuard
            permissions={[PERMISSIONS.TREATMENT_PLAN_VIEW, PERMISSIONS.TREATMENT_PLAN_ALL]}
          >
            <Button asChild variant="outline">
              <Link to={`${APP_ROUTES.TREATMENT_PLANS}?consultationId=${consultation.id}`}>
                {t('nav.treatmentPlans', 'Treatment plans')}
              </Link>
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_1fr_280px]">
        <div className="rounded-xl border bg-card">
          <PatientSummarySidebar
            summary={summaryQuery.data}
            loading={summaryQuery.isLoading}
          />
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-4 flex flex-wrap gap-1 border-b pb-2">
            {WORKSPACE_TABS.map((wt) => (
              <button
                key={wt.id}
                type="button"
                onClick={() => setTab(wt.id)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition',
                  tab === wt.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {tabLabel(wt.id)}
              </button>
            ))}
          </div>

          {tab === 'soap' && (
            <SoapEditor consultationId={id} soap={data.soap} readOnly={readOnly} />
          )}
          {tab === 'vitals' && (
            <VitalsForm consultationId={id} vitals={data.vitals} readOnly={readOnly} />
          )}
          {tab === 'exam' && (
            <ExaminationForm
              consultationId={id}
              examination={data.examination}
              readOnly={readOnly}
            />
          )}
          {tab === 'diagnosis' && (
            <DiagnosisForm
              consultationId={id}
              diagnosis={data.diagnosis}
              readOnly={readOnly}
            />
          )}
          {tab === 'photos' && (
            <ClinicalPhotosPanel
              consultationId={id}
              photos={data.photos || []}
              readOnly={readOnly}
            />
          )}
          {tab === 'followup' && (
            <div className="space-y-3">
              <h3 className="font-semibold">{t('consultations.followUp.title', 'Follow-up recommendation')}</h3>
              <p className="text-xs text-muted-foreground">
                {t('consultations.followUp.hint', 'Appointment module will consume this later.')}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t('consultations.followUp.value', 'Value')}</Label>
                  <Input
                    type="number"
                    value={followUp.value}
                    disabled={readOnly}
                    onChange={(e) => setFollowUp((p) => ({ ...p, value: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label>{t('consultations.followUp.unit', 'Unit')}</Label>
                  <Select
                    value={followUp.unit}
                    disabled={readOnly}
                    onChange={(e) => setFollowUp((p) => ({ ...p, unit: e.target.value }))}
                  >
                    {FOLLOW_UP_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {followUpUnitLabel(u.value)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t('consultations.followUp.reason', 'Reason')}</Label>
                <Input
                  value={followUp.reason}
                  disabled={readOnly}
                  onChange={(e) => setFollowUp((p) => ({ ...p, reason: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('consultations.followUp.instructions', 'Instructions')}</Label>
                <textarea
                  className="min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm"
                  value={followUp.instructions}
                  disabled={readOnly}
                  onChange={(e) =>
                    setFollowUp((p) => ({ ...p, instructions: e.target.value }))
                  }
                />
              </div>
              {!readOnly && (
                <Button
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({
                      followUp: {
                        value: followUp.value ? Number(followUp.value) : null,
                        unit: followUp.unit,
                        reason: followUp.reason || null,
                        instructions: followUp.instructions || null,
                      },
                    })
                  }
                >
                  {t('consultations.followUp.save', 'Save follow-up')}
                </Button>
              )}
              {user?.role === 'OWNER' && consultation.locked && (
                <p className="text-xs text-muted-foreground">
                  {t('consultations.followUp.unlockNote', 'Unlock is available via API for Owner only.')}
                </p>
              )}
            </div>
          )}
          {tab === 'ai' && (
            <AiAssistPanel
              patientId={patientId}
              consultationId={id}
              context={{ chiefComplaint: consultation?.chiefComplaint }}
            />
          )}
        </div>

        <div className="rounded-xl border bg-card">
          <TimelinePanel summary={summaryQuery.data} loading={summaryQuery.isLoading} />
        </div>
      </div>
    </section>
  );
}
