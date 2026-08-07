import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import {
  useDoctorTreatmentPlans,
  useCreateTreatmentPlan,
  useDeleteTreatmentPlan,
} from '@/modules/treatmentPlans/hooks/useTreatmentPlans';
import { TREATMENT_PLAN_STATUS_LABELS } from '@/modules/treatmentPlans/constants';
import {
  APP_ROUTES,
  treatmentPlanEditPath,
  treatmentPlanPrintPath,
} from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

export default function TreatmentPlanListPage() {
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
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('treatmentPlans.list.title', 'Treatment Plans')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'treatmentPlans.list.subtitle',
              'Doctor-driven planning only — no sessions, billing, or inventory.'
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={APP_ROUTES.TREATMENT_PROTOCOLS}>
              {t('treatmentPlans.list.protocolsLink', 'Protocols')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={APP_ROUTES.TREATMENT_PACKAGES}>
              {t('treatmentPlans.list.packagesLink', 'Packages')}
            </Link>
          </Button>
        </div>
      </div>

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
        {isLoading && (
          <p className="text-sm text-muted-foreground">
            {t('treatmentPlans.list.loading', 'Loading…')}
          </p>
        )}
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
                  ·{' '}
                  {plan.createdAt ? new Date(plan.createdAt).toLocaleString() : '—'}
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
          <p className="text-sm text-muted-foreground">
            {t('treatmentPlans.list.emptyState', 'No treatment plans yet.')}
          </p>
        )}
      </div>
    </section>
  );
}
