import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Stethoscope, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { APP_ROUTES, treatmentPlanEditPath } from '@/constants/routes';
import { useCreateTreatmentPlan, usePatientTreatmentPlans } from '@/modules/treatmentPlans/hooks/useTreatmentPlans';
import { CATEGORY_OPTIONS, PRIORITY_OPTIONS, TREATMENT_PLAN_STATUS_LABELS } from '@/modules/treatmentPlans/constants';
import { TreatmentPlanForm } from '@/modules/treatmentPlans/components/TreatmentPlanForm';

const EMPTY_ORDER = {
  title: '',
  category: 'Other',
  clinicalGoal: '',
  estimatedSessions: 1,
  priority: 'NORMAL',
  remarks: '',
};

/**
 * §3.5 "Send to treatment" — a same-day/future treatment order created without leaving the
 * consultation workspace. This covers the common case (service/indication/body-area, sessions,
 * urgency, instructions) directly; the multi-step wizard (protocol, package, consent, room/device
 * checks) still lives in the full Treatment Plan builder, which this panel links to once a plan
 * exists so the doctor never loses the plan's context.
 */
export function TreatmentOrderPanel({ consultationId, patientId, readOnly }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY_ORDER);
  const create = useCreateTreatmentPlan();
  const { data: plans = [], isLoading } = usePatientTreatmentPlans(patientId);
  const [openPlanId, setOpenPlanId] = useState(null);

  const patch = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  const consultationPlans = plans.filter((p) => p.consultationId === consultationId);

  const submit = () => {
    if (!form.title.trim()) return;
    create.mutate(
      {
        consultationId,
        title: form.title.trim(),
        category: form.category,
        clinicalGoal: form.clinicalGoal || undefined,
        estimatedSessions: form.estimatedSessions ? Number(form.estimatedSessions) : undefined,
        priority: form.priority,
        remarks: form.remarks || undefined,
      },
      { onSuccess: () => setForm(EMPTY_ORDER) }
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <Stethoscope className="h-4 w-4" />
        {t('consultations.treatment.title', 'Treatment order')}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t(
          'consultations.treatment.hint',
          'Creates a treatment plan linked to this consultation. Protocol, package, consent and room/device checks continue in the full builder.'
        )}
      </p>

      {consultationPlans.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t('consultations.treatment.existing', 'Orders from this consultation')}
          </p>
          {consultationPlans.map((plan) => (
            <div key={plan.id} className="space-y-2 rounded-lg border p-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{plan.title}</p>
                  <Badge variant="secondary" className="mt-1">
                    {TREATMENT_PLAN_STATUS_LABELS[plan.status] || plan.status}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={openPlanId === plan.id ? 'default' : 'outline'}
                    onClick={() => setOpenPlanId((cur) => (cur === plan.id ? null : plan.id))}
                  >
                    {openPlanId === plan.id
                      ? t('consultations.treatment.hideBuilder', 'Hide')
                      : t('consultations.treatment.editHere', 'Edit here')}
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={treatmentPlanEditPath(plan.id)}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t('consultations.treatment.openBuilder', 'Open full page')}
                    </Link>
                  </Button>
                </div>
              </div>
              {/* Full wizard (protocol/package/consents/approve) inline — same component/hooks as
                  the standalone Treatment Plan builder page, so nothing is duplicated. */}
              {openPlanId === plan.id && (
                <div className="border-t pt-2">
                  <TreatmentPlanForm planId={plan.id} embedded />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{t('consultations.treatment.serviceProtocol', 'Service / protocol')}</Label>
              <Input value={form.title} onChange={patch('title')} placeholder={t('consultations.treatment.serviceProtocolPlaceholder', 'e.g. Diode laser hair reduction')} />
            </div>
            <div className="space-y-1">
              <Label>{t('consultations.treatment.category', 'Category')}</Label>
              <Select value={form.category} onChange={patch('category')}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('consultations.treatment.indication', 'Indication / body area')}</Label>
              <Input value={form.clinicalGoal} onChange={patch('clinicalGoal')} />
            </div>
            <div className="space-y-1">
              <Label>{t('consultations.treatment.sessions', 'No. of sessions')}</Label>
              <Input type="number" min="1" value={form.estimatedSessions} onChange={patch('estimatedSessions')} />
            </div>
            <div className="space-y-1">
              <Label>{t('consultations.treatment.urgency', 'Urgency')}</Label>
              <Select value={form.priority} onChange={patch('priority')}>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t('consultations.treatment.instructions', 'Instructions')}</Label>
            <textarea
              className="min-h-[72px] w-full rounded-lg border px-3 py-2 text-sm"
              value={form.remarks}
              onChange={patch('remarks')}
            />
          </div>
          <PermissionGuard permissions={[PERMISSIONS.TREATMENT_PLAN_CREATE, PERMISSIONS.TREATMENT_PLAN_ALL]}>
            <Button size="sm" disabled={create.isPending || !form.title.trim()} onClick={submit}>
              {t('consultations.treatment.send', 'Send to treatment')}
            </Button>
          </PermissionGuard>
        </div>
      )}

      <PermissionGuard permissions={[PERMISSIONS.TREATMENT_PLAN_VIEW, PERMISSIONS.TREATMENT_PLAN_ALL]}>
        <Button asChild size="sm" variant="ghost">
          <Link to={`${APP_ROUTES.TREATMENT_PLANS}?consultationId=${consultationId}`}>
            {t('consultations.treatment.viewAll', 'View all plans for this patient')}
          </Link>
        </Button>
      </PermissionGuard>
    </div>
  );
}

export default TreatmentOrderPanel;
