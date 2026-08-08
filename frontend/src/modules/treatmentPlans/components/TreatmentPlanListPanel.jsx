import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import {
  useDoctorTreatmentPlans,
  useCreateTreatmentPlan,
  useDeleteTreatmentPlan,
} from '../hooks/useTreatmentPlans';
import { TREATMENT_PLAN_STATUS_LABELS } from '../constants';
import { treatmentPlanEditPath, treatmentPlanPrintPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

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

  const { data: doctorsData } = useDoctorList({ limit: 50 });
  const doctors = doctorsData?.items || [];
  const [doctorId, setDoctorId] = useState('');
  const effectiveDoctorId = doctorId || doctors[0]?.id || '';

  const { data: plans = [], isLoading } = useDoctorTreatmentPlans(effectiveDoctorId);
  const create = useCreateTreatmentPlan();
  const remove = useDeleteTreatmentPlan();
  const [newConsultationId, setNewConsultationId] = useState(consultationId);

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
        <Select value={effectiveDoctorId} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">{t('treatmentPlans.list.selectDoctor', 'Select doctor')}</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.doctorCode} — {d.user?.fullName || t('treatmentPlans.list.doctorFallback', 'Doctor')}
            </option>
          ))}
        </Select>
        <Input
          placeholder={t(
            'treatmentPlans.list.consultationIdPlaceholder',
            'Consultation ID to create plan…'
          )}
          value={newConsultationId}
          onChange={(e) => setNewConsultationId(e.target.value)}
        />
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
