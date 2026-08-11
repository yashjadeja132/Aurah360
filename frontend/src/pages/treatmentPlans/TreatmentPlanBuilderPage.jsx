import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { TreatmentPlanForm } from '@/modules/treatmentPlans/components/TreatmentPlanForm';
import { useTreatmentPlan } from '@/modules/treatmentPlans/hooks/useTreatmentPlans';
import { TREATMENT_PLAN_STATUS_LABELS, EDITABLE_STATUSES } from '@/modules/treatmentPlans/constants';
import { APP_ROUTES, treatmentPlanPrintPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

/**
 * Thin page shell: header (back/print/invoice) + the shared wizard body. The wizard itself
 * (`TreatmentPlanForm`) is also mounted inline inside the Consultation Workspace's Treatment tab —
 * this file must not re-implement any of its logic.
 */
export default function TreatmentPlanBuilderPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: plan, isLoading, isError, error } = useTreatmentPlan(id);

  if (isLoading)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t('treatmentPlans.planBuilder.loading', 'Loading…')}
      </p>
    );
  if (isError || !plan) {
    return (
      <p className="p-6 text-sm text-destructive">
        {error?.response?.data?.message ||
          t('treatmentPlans.planBuilder.notFound', 'Treatment plan not found')}
      </p>
    );
  }

  const readOnly = !EDITABLE_STATUSES.includes(plan.status);

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to={APP_ROUTES.TREATMENT_PLANS}>
              <ArrowLeft className="h-4 w-4" />
              {t('treatmentPlans.planBuilder.back', 'Back')}
            </Link>
          </Button>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-primary">{plan.planNumber}</h1>
            <Badge variant={readOnly ? 'success' : 'warning'}>
              {TREATMENT_PLAN_STATUS_LABELS[plan.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {plan.patient?.fullName} ·{' '}
            {t('treatmentPlans.planBuilder.doctorPrefix', {
              defaultValue: 'Dr. {{name}}',
              name: plan.doctor?.name || '—',
            })}{' '}
            · {plan.consultation?.consultationNumber}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={treatmentPlanPrintPath(id)}>
              <Printer className="h-4 w-4" />
              {t('treatmentPlans.planBuilder.print', 'Print')}
            </Link>
          </Button>
          <PermissionGuard permissions={[PERMISSIONS.BILLING_CREATE, PERMISSIONS.BILLING_ALL]}>
            <Button asChild variant="outline">
              <Link to={`${APP_ROUTES.BILLING}?treatmentPlanId=${id}`}>
                {t('treatmentPlans.planBuilder.createInvoice', 'Create invoice')}
              </Link>
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <TreatmentPlanForm planId={id} />
    </section>
  );
}
