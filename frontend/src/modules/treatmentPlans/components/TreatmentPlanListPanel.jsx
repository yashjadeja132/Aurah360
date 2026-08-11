import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { SearchableCombobox } from '@/components/common/SearchableCombobox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useAuth } from '@/contexts/AuthContext';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useConsultationDetail } from '@/modules/consultations/hooks/useConsultations';
import {
  useDoctorTreatmentPlans,
  useCreateTreatmentPlan,
  useDeleteTreatmentPlan,
} from '../hooks/useTreatmentPlans';
import { TREATMENT_PLAN_STATUS_LABELS } from '../constants';
import { treatmentPlanEditPath, treatmentPlanPrintPath } from '@/constants/routes';
import { PERMISSIONS, ROLES } from '@/constants/rbac';

/**
 * Plans tab of the Treatments hub. This is the former `TreatmentPlanListPage` body, extracted
 * verbatim in behaviour (same hooks, same permission gates) so it can render inside the hub's
 * tab shell instead of as its own top-level route. The plan BUILDER stays a separate route —
 * it is a multi-step record editor, not a tab.
 */
export function TreatmentPlanListPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const consultationId = searchParams.get('consultationId') || '';
  const { user } = useAuth();
  // Same fix as ConsultationListPage.jsx / PrescriptionListPage.jsx — a DOCTOR must not be
  // offered a picker over every other doctor's treatment plans. Backend already 403s/404s a
  // DOCTOR requesting someone else's doctorId (scope.helper.js#resolveDoctorScope via
  // TreatmentPlanController's scopedListQuery).
  const isDoctorRole = user?.role === ROLES.DOCTOR;

  const { data: doctorsData } = useDoctorList({ limit: 50 });
  const doctors = isDoctorRole ? [] : doctorsData?.items || [];
  const [doctorId, setDoctorId] = useState('');
  const effectiveDoctorId = isDoctorRole ? undefined : doctorId || doctors[0]?.id || '';

  const { data: plans = [], isLoading } = useDoctorTreatmentPlans(effectiveDoctorId);
  const create = useCreateTreatmentPlan();
  const remove = useDeleteTreatmentPlan();
  const [newConsultationId, setNewConsultationId] = useState(consultationId);
  // Only queried for the URL-provided consultationId (deep-link from the consultation
  // workspace's "Treatment plan" action) — lets the raw ObjectId stay internal-only while the
  // visible label is the human-readable consultation number + patient name.
  const { data: linkedConsultation } = useConsultationDetail(consultationId);

  const startPlan = async () => {
    if (!newConsultationId) return;
    const res = await create.mutateAsync({
      consultationId: newConsultationId,
      title: t('treatmentPlans.list.newPlanTitle', 'New treatment plan'),
      diagnosisSummary: '',
      items: [],
    });
    const id = res?.data?.plan?.id;
    if (id) navigate(treatmentPlanEditPath(id));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          'treatmentPlans.list.subtitle',
          'Doctor-driven planning only — no sessions, billing, or inventory.'
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!isDoctorRole && (
          <SearchableCombobox
            value={effectiveDoctorId}
            onChange={setDoctorId}
            options={doctors}
            filterKeys={['doctorCode']}
            renderLabel={(d) => d.user?.fullName || t('treatmentPlans.list.doctorFallback', 'Doctor')}
            renderSublabel={(d) => `(${d.doctorCode})`}
            placeholder={t('treatmentPlans.list.selectDoctor', 'Select doctor')}
            emptyText={t('treatmentPlans.list.noDoctorMatch', 'No doctor matches')}
          />
        )}
        {consultationId ? (
          // Deep-linked from a consultation — show the human-readable reference, never the
          // raw ObjectId. newConsultationId (used by startPlan) stays set to the real id
          // underneath; only the display differs.
          <div className="flex w-fit max-w-full items-center gap-2 whitespace-nowrap rounded-md border bg-muted/40 px-3 py-2 text-sm sm:col-span-2">
            <ClipboardList className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">
              {linkedConsultation?.consultationNumber || t('common.loading', 'Loading…')}
            </span>
            {linkedConsultation?.patient?.fullName && (
              <span className="text-muted-foreground">· {linkedConsultation.patient.fullName}</span>
            )}
          </div>
        ) : (
          <Input
            placeholder={t(
              'treatmentPlans.list.consultationIdPlaceholder',
              'Consultation ID to create plan…'
            )}
            value={newConsultationId}
            onChange={(e) => setNewConsultationId(e.target.value)}
          />
        )}
        <PermissionGuard
          permissions={[PERMISSIONS.TREATMENT_PLAN_CREATE, PERMISSIONS.TREATMENT_PLAN_ALL]}
        >
          <Button onClick={startPlan} disabled={!newConsultationId || create.isPending}>
            <Plus className="h-4 w-4" />
            {t('treatmentPlans.list.newPlan', 'New plan')}
          </Button>
        </PermissionGuard>
      </div>

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <ClipboardList className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">
                  {plan.planNumber} · {plan.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.patient?.fullName || t('treatmentPlans.list.patientFallback', 'Patient')} ·{' '}
                  {t('treatmentPlans.list.proceduresCount', {
                    defaultValue: '{{count}} procedures',
                    count: plan.items?.length || 0,
                  })}{' '}
                  · {plan.createdAt ? new Date(plan.createdAt).toLocaleString() : '—'}
                </p>
                {/* §5 — session progress + package balance, display-only off fields the list
                    endpoint already computes/returns (TreatmentPlanService#attachSessionProgress). */}
                <p className="text-xs text-muted-foreground">
                  {t('treatmentPlans.list.sessionsProgress', {
                    defaultValue: '{{completed}} of {{total}} sessions',
                    completed: plan.sessionsCompleted ?? 0,
                    total: plan.sessionsScheduled || plan.estimatedSessions || 0,
                  })}
                  {plan.packageBalance?.maximumSessions != null && (
                    <>
                      {' · '}
                      {t('treatmentPlans.list.packageBalance', {
                        defaultValue: 'Package balance: {{unused}} / {{max}}',
                        unused: plan.packageBalance.unusedSessions ?? 0,
                        max: plan.packageBalance.maximumSessions,
                      })}
                    </>
                  )}
                </p>
              </div>
              <Badge
                variant={
                  plan.status === 'ACCEPTED' || plan.status === 'COMPLETED'
                    ? 'success'
                    : plan.status === 'REJECTED' || plan.status === 'CANCELLED'
                      ? 'destructive'
                      : 'warning'
                }
              >
                {TREATMENT_PLAN_STATUS_LABELS[plan.status] || plan.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={treatmentPlanEditPath(plan.id)}>
                  {t('treatmentPlans.list.open', 'Open')}
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={treatmentPlanPrintPath(plan.id)}>
                  {t('treatmentPlans.list.print', 'Print')}
                </Link>
              </Button>
              {plan.status === 'DRAFT' && (
                <PermissionGuard
                  permissions={[PERMISSIONS.TREATMENT_PLAN_EDIT, PERMISSIONS.TREATMENT_PLAN_ALL]}
                >
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(plan.id)}>
                    {t('treatmentPlans.list.delete', 'Delete')}
                  </Button>
                </PermissionGuard>
              )}
            </div>
          </div>
        ))}
        {!plans.length && !isLoading && (
          <EmptyState
            icon={ClipboardList}
            title={t('treatmentPlans.list.emptyState', 'No treatment plans yet.')}
            description={t(
              'treatmentPlans.list.emptyHint',
              'Pick a doctor above, or create a plan from an accepted consultation.'
            )}
          />
        )}
      </div>
    </div>
  );
}

export default TreatmentPlanListPanel;
