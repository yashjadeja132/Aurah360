import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PlanItemEditor } from '@/modules/treatmentPlans/components/PlanItemEditor';
import {
  useTreatmentPlan,
  useUpdateTreatmentPlan,
  useApplyProtocol,
  useApplyPackage,
  useRecommendPlan,
  useApprovePlan,
  useAcceptPlan,
  useRejectPlan,
  useCancelPlan,
  useAcceptConsent,
  useProtocols,
  usePackages,
} from '@/modules/treatmentPlans/hooks/useTreatmentPlans';
import { localDateKey } from '@/utils/date';
import {
  TREATMENT_PLAN_STATUS_LABELS,
  EDITABLE_STATUSES,
  PRIORITY_OPTIONS,
  CATEGORY_OPTIONS,
  CONSENT_TYPE_LABELS,
  WIZARD_STEPS,
  emptyItem,
} from '@/modules/treatmentPlans/constants';
import { APP_ROUTES, treatmentPlanPrintPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';

function toPayloadItems(items) {
  return items
    .filter((it) => it.procedureName?.trim())
    .map((it) => ({
      ...it,
      serviceId: it.serviceId || null,
      consumables: Array.isArray(it.consumables)
        ? it.consumables
        : String(it.consumables || '')
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
    }));
}

export default function TreatmentPlanBuilderPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: plan, isLoading, isError, error } = useTreatmentPlan(id);
  const update = useUpdateTreatmentPlan(id);
  const applyProtocol = useApplyProtocol(id);
  const applyPackage = useApplyPackage(id);
  const recommend = useRecommendPlan(id);
  const approve = useApprovePlan(id);
  const accept = useAcceptPlan(id);
  const reject = useRejectPlan(id);
  const cancel = useCancelPlan(id);
  const acceptConsent = useAcceptConsent(id);
  const { data: protocols = [] } = useProtocols();
  const { data: packages = [] } = usePackages();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '',
    diagnosisSummary: '',
    clinicalGoal: '',
    description: '',
    category: 'Other',
    priority: 'NORMAL',
    estimatedDuration: '',
    estimatedSessions: 1,
    remarks: '',
    items: [],
    goals: {
      expectedResults: '',
      clinicalObjectives: '',
      beforePhotosReference: '',
      reviewDate: '',
    },
    followUp: { reviewAfterDays: '', reviewAfterSession: '' },
  });
  const [signName, setSignName] = useState('');

  useEffect(() => {
    if (!plan) return;
    setForm({
      title: plan.title || '',
      diagnosisSummary: plan.diagnosisSummary || '',
      clinicalGoal: plan.clinicalGoal || '',
      description: plan.description || '',
      category: plan.category || 'Other',
      priority: plan.priority || 'NORMAL',
      estimatedDuration: plan.estimatedDuration || '',
      estimatedSessions: plan.estimatedSessions || 1,
      remarks: plan.remarks || '',
      items: (plan.items || []).map((it) => ({
        ...emptyItem(),
        ...it,
        consumables: Array.isArray(it.consumables) ? it.consumables.join(', ') : it.consumables || '',
      })),
      goals: {
        expectedResults: plan.goals?.expectedResults || '',
        clinicalObjectives: plan.goals?.clinicalObjectives || '',
        beforePhotosReference: plan.goals?.beforePhotosReference || '',
        // A review date is a CALENDAR DAY stored as local start-of-day; a UTC slice showed it a
        // day early and would persist that shift on the next save. See `@/utils/date`.
        reviewDate: localDateKey(plan.goals?.reviewDate || ''),
      },
      followUp: {
        reviewAfterDays: plan.followUp?.reviewAfterDays ?? '',
        reviewAfterSession: plan.followUp?.reviewAfterSession ?? '',
      },
    });
  }, [plan?.id, plan?.updatedAt]);

  const readOnly = plan ? !EDITABLE_STATUSES.includes(plan.status) : true;

  const save = async () => {
    await update.mutateAsync({
      title: form.title,
      diagnosisSummary: form.diagnosisSummary,
      clinicalGoal: form.clinicalGoal,
      description: form.description,
      category: form.category,
      priority: form.priority,
      estimatedDuration: form.estimatedDuration || null,
      estimatedSessions: Number(form.estimatedSessions) || 1,
      remarks: form.remarks || null,
      items: toPayloadItems(form.items),
      goals: {
        ...form.goals,
        reviewDate: form.goals.reviewDate || null,
      },
      followUp: {
        reviewAfterDays:
          form.followUp.reviewAfterDays === '' ? null : Number(form.followUp.reviewAfterDays),
        reviewAfterSession:
          form.followUp.reviewAfterSession === ''
            ? null
            : Number(form.followUp.reviewAfterSession),
      },
    });
  };

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
          {!readOnly && (
            <PermissionGuard
              permissions={[PERMISSIONS.TREATMENT_PLAN_EDIT, PERMISSIONS.TREATMENT_PLAN_ALL]}
            >
              <Button variant="outline" disabled={update.isPending} onClick={save}>
                {t('treatmentPlans.planBuilder.save', 'Save')}
              </Button>
            </PermissionGuard>
          )}
          <Button asChild variant="outline">
            <Link to={treatmentPlanPrintPath(id)}>
              <Printer className="h-4 w-4" />
              {t('treatmentPlans.planBuilder.print', 'Print')}
            </Link>
          </Button>
          <PermissionGuard
            permissions={[PERMISSIONS.BILLING_CREATE, PERMISSIONS.BILLING_ALL]}
          >
            <Button asChild variant="outline">
              <Link to={`${APP_ROUTES.BILLING}?treatmentPlanId=${id}`}>
                {t('treatmentPlans.planBuilder.createInvoice', 'Create invoice')}
              </Link>
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {WIZARD_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(s.id)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition',
              step === s.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {s.id}. {s.label}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3 rounded-xl border p-4">
          <h2 className="font-semibold">
            {t('treatmentPlans.planBuilder.step1.heading', 'Diagnosis & goals')}
          </h2>
          <div>
            <Label>{t('treatmentPlans.planBuilder.step1.title', 'Title')}</Label>
            <Input
              disabled={readOnly}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t('treatmentPlans.planBuilder.step1.diagnosisSummary', 'Diagnosis summary')}</Label>
            <Input
              disabled={readOnly}
              value={form.diagnosisSummary}
              onChange={(e) => setForm((f) => ({ ...f, diagnosisSummary: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t('treatmentPlans.planBuilder.step1.clinicalGoal', 'Clinical goal')}</Label>
            <Input
              disabled={readOnly}
              value={form.clinicalGoal}
              onChange={(e) => setForm((f) => ({ ...f, clinicalGoal: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t('treatmentPlans.planBuilder.step1.category', 'Category')}</Label>
              <Select
                disabled={readOnly}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t('treatmentPlans.planBuilder.step1.priority', 'Priority')}</Label>
              <Select
                disabled={readOnly}
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label>{t('treatmentPlans.planBuilder.step1.expectedResults', 'Expected results')}</Label>
            <Input
              disabled={readOnly}
              value={form.goals.expectedResults}
              onChange={(e) =>
                setForm((f) => ({ ...f, goals: { ...f.goals, expectedResults: e.target.value } }))
              }
            />
          </div>
          <div>
            <Label>
              {t('treatmentPlans.planBuilder.step1.clinicalObjectives', 'Clinical objectives')}
            </Label>
            <Input
              disabled={readOnly}
              value={form.goals.clinicalObjectives}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  goals: { ...f.goals, clinicalObjectives: e.target.value },
                }))
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>
                {t(
                  'treatmentPlans.planBuilder.step1.beforePhotosReference',
                  'Before photos reference'
                )}
              </Label>
              <Input
                disabled={readOnly}
                value={form.goals.beforePhotosReference}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    goals: { ...f.goals, beforePhotosReference: e.target.value },
                  }))
                }
              />
            </div>
            <div>
              <Label>{t('treatmentPlans.planBuilder.step1.reviewDate', 'Review date')}</Label>
              <Input
                type="date"
                disabled={readOnly}
                value={form.goals.reviewDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, goals: { ...f.goals, reviewDate: e.target.value } }))
                }
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>
                {t('treatmentPlans.planBuilder.step1.reviewAfterDays', 'Review after X days')}
              </Label>
              <Input
                type="number"
                min={0}
                disabled={readOnly}
                value={form.followUp.reviewAfterDays}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    followUp: { ...f.followUp, reviewAfterDays: e.target.value },
                  }))
                }
              />
            </div>
            <div>
              <Label>
                {t(
                  'treatmentPlans.planBuilder.step1.reviewAfterSession',
                  'Review after session Y'
                )}
              </Label>
              <Input
                type="number"
                min={1}
                disabled={readOnly}
                value={form.followUp.reviewAfterSession}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    followUp: { ...f.followUp, reviewAfterSession: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3 rounded-xl border p-4">
          <h2 className="font-semibold">
            {t('treatmentPlans.planBuilder.step2.heading', 'Select protocol')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              'treatmentPlans.planBuilder.step2.subtitle',
              'Selecting a protocol auto-fills sessions, devices, consumables, and instructions.'
            )}
          </p>
          {plan.protocol && (
            <p className="text-sm">
              {t('treatmentPlans.planBuilder.step2.current', 'Current:')}{' '}
              <strong>{plan.protocol.name}</strong> ({plan.protocol.protocolCode})
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {protocols.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={readOnly || applyProtocol.isPending}
                onClick={() => applyProtocol.mutate(p.id)}
                className={cn(
                  'rounded-xl border p-3 text-left transition hover:border-primary',
                  plan.protocolId === p.id && 'border-primary bg-primary/5'
                )}
              >
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t('treatmentPlans.planBuilder.step2.protocolMeta', {
                    defaultValue: '{{category}} · {{sessions}} sessions · {{code}}',
                    category: p.category,
                    sessions: p.estimatedSessions,
                    code: p.protocolCode,
                  })}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 rounded-xl border p-4">
          <h2 className="font-semibold">
            {t('treatmentPlans.planBuilder.step3.heading', 'Customize sessions')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>
                {t('treatmentPlans.planBuilder.step3.estimatedDuration', 'Estimated duration')}
              </Label>
              <Input
                disabled={readOnly}
                value={form.estimatedDuration}
                onChange={(e) => setForm((f) => ({ ...f, estimatedDuration: e.target.value }))}
              />
            </div>
            <div>
              <Label>
                {t('treatmentPlans.planBuilder.step3.estimatedSessions', 'Estimated sessions')}
              </Label>
              <Input
                type="number"
                min={1}
                disabled={readOnly}
                value={form.estimatedSessions}
                onChange={(e) => setForm((f) => ({ ...f, estimatedSessions: e.target.value }))}
              />
            </div>
          </div>
          <PlanItemEditor
            items={form.items}
            readOnly={readOnly}
            onChange={(items) => setForm((f) => ({ ...f, items }))}
          />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3 rounded-xl border p-4">
          <h2 className="font-semibold">
            {t('treatmentPlans.planBuilder.step4.heading', 'Package (pricing metadata only)')}
          </h2>
          {plan.packageSnapshot && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">{plan.packageSnapshot.packageName}</p>
              <p>
                {t('treatmentPlans.planBuilder.step4.packageLine', {
                  defaultValue:
                    'Price ₹{{price}} · Discount ₹{{discount}} · Max sessions {{max}} · Unused {{unused}} · Validity {{validity}} days',
                  price: plan.packageSnapshot.packagePrice,
                  discount: plan.packageSnapshot.discount || 0,
                  max: plan.packageSnapshot.maximumSessions,
                  unused: plan.packageSnapshot.unusedSessions,
                  validity: plan.packageSnapshot.validityDays,
                })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('treatmentPlans.planBuilder.step4.noBilling', 'No billing created.')}
              </p>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                disabled={readOnly || applyPackage.isPending}
                onClick={() => applyPackage.mutate(pkg.id)}
                className="rounded-xl border p-3 text-left transition hover:border-primary"
              >
                <p className="font-medium">{pkg.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t('treatmentPlans.planBuilder.step4.packageMeta', {
                    defaultValue: '₹{{price}} · {{sessions}} sessions · {{code}}',
                    price: pkg.packagePrice,
                    sessions: pkg.maximumSessions,
                    code: pkg.packageCode,
                  })}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-3 rounded-xl border p-4">
          <h2 className="font-semibold">{t('treatmentPlans.planBuilder.step5.heading', 'Consents')}</h2>
          <p className="text-sm text-muted-foreground">
            {t(
              'treatmentPlans.planBuilder.step5.subtitle',
              'Required: Laser, Photography, Treatment, Procedure. E-sign is a placeholder.'
            )}
          </p>
          <div>
            <Label>
              {t('treatmentPlans.planBuilder.step5.signerName', 'Signer name (placeholder e-sign)')}
            </Label>
            <Input value={signName} onChange={(e) => setSignName(e.target.value)} />
          </div>
          <div className="space-y-2">
            {(plan.consents || []).map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {CONSENT_TYPE_LABELS[c.consentType] || c.consentType} — {c.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.status}</p>
                </div>
                {c.status !== 'ACCEPTED' && !readOnly && (
                  <Button
                    size="sm"
                    disabled={acceptConsent.isPending}
                    onClick={() =>
                      acceptConsent.mutate({
                        consentId: c.id,
                        signedByName: signName || plan.patient?.fullName,
                        signatureData: 'E_SIGN_PLACEHOLDER',
                      })
                    }
                  >
                    <Check className="h-4 w-4" />
                    {t('treatmentPlans.planBuilder.step5.accept', 'Accept')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-4 rounded-xl border p-4">
          <h2 className="font-semibold">
            {t('treatmentPlans.planBuilder.step6.heading', 'Review & actions')}
          </h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">
                {t('treatmentPlans.planBuilder.step6.title', 'Title')}
              </dt>
              <dd className="font-medium">{plan.title}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t('treatmentPlans.planBuilder.step6.status', 'Status')}
              </dt>
              <dd className="font-medium">{TREATMENT_PLAN_STATUS_LABELS[plan.status]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t('treatmentPlans.planBuilder.step6.procedures', 'Procedures')}
              </dt>
              <dd className="font-medium">{plan.items?.length || 0}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t('treatmentPlans.planBuilder.step6.estimatedSessions', 'Estimated sessions')}
              </dt>
              <dd className="font-medium">{plan.estimatedSessions}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t('treatmentPlans.planBuilder.step6.package', 'Package')}
              </dt>
              <dd className="font-medium">{plan.packageSnapshot?.packageName || '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t('treatmentPlans.planBuilder.step6.consentsAccepted', 'Consents accepted')}
              </dt>
              <dd className="font-medium">
                {(plan.consents || []).filter((c) => c.status === 'ACCEPTED').length}/
                {(plan.consents || []).length}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            {plan.status === 'DRAFT' && (
              <PermissionGuard
                permissions={[PERMISSIONS.TREATMENT_PLAN_EDIT, PERMISSIONS.TREATMENT_PLAN_ALL]}
              >
                <Button
                  variant="outline"
                  disabled={recommend.isPending}
                  onClick={async () => {
                    await save();
                    recommend.mutate();
                  }}
                >
                  {t('treatmentPlans.planBuilder.step6.markRecommended', 'Mark recommended')}
                </Button>
              </PermissionGuard>
            )}
            {(plan.status === 'DRAFT' || plan.status === 'RECOMMENDED') && (
              <PermissionGuard
                permissions={[PERMISSIONS.TREATMENT_PLAN_APPROVE, PERMISSIONS.TREATMENT_PLAN_ALL]}
              >
                <Button
                  disabled={approve.isPending}
                  onClick={async () => {
                    if (!readOnly) await save();
                    approve.mutate();
                  }}
                >
                  {t('treatmentPlans.planBuilder.step6.approve', 'Approve')}
                </Button>
              </PermissionGuard>
            )}
            {plan.status === 'APPROVED' && (
              <PermissionGuard
                permissions={[PERMISSIONS.TREATMENT_PLAN_ACCEPT, PERMISSIONS.TREATMENT_PLAN_ALL]}
              >
                <Button disabled={accept.isPending} onClick={() => accept.mutate()}>
                  {t('treatmentPlans.planBuilder.step6.acceptPlan', 'Accept plan')}
                </Button>
              </PermissionGuard>
            )}
            {!['REJECTED', 'CANCELLED', 'COMPLETED', 'ACCEPTED'].includes(plan.status) && (
              <>
                <PermissionGuard
                  permissions={[
                    PERMISSIONS.TREATMENT_PLAN_APPROVE,
                    PERMISSIONS.TREATMENT_PLAN_ACCEPT,
                    PERMISSIONS.TREATMENT_PLAN_ALL,
                  ]}
                >
                  <Button
                    variant="outline"
                    disabled={reject.isPending}
                    onClick={() =>
                      reject.mutate(
                        t('treatmentPlans.planBuilder.step6.rejectedFromBuilder', 'Rejected from builder')
                      )
                    }
                  >
                    {t('treatmentPlans.planBuilder.step6.reject', 'Reject')}
                  </Button>
                </PermissionGuard>
                <PermissionGuard
                  permissions={[PERMISSIONS.TREATMENT_PLAN_EDIT, PERMISSIONS.TREATMENT_PLAN_ALL]}
                >
                  <Button
                    variant="ghost"
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate()}
                  >
                    {t('treatmentPlans.planBuilder.step6.cancel', 'Cancel')}
                  </Button>
                </PermissionGuard>
              </>
            )}
          </div>
          {plan.status === 'ACCEPTED' && (
            <p className="text-sm text-muted-foreground">
              {t(
                'treatmentPlans.planBuilder.step6.lockedNotice',
                'Plan is locked. Treatment Execution will consume this plan later — no sessions created here.'
              )}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={step <= 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
        >
          {t('treatmentPlans.planBuilder.previous', 'Previous')}
        </Button>
        <Button disabled={step >= 6} onClick={() => setStep((s) => Math.min(6, s + 1))}>
          {t('treatmentPlans.planBuilder.next', 'Next')}
        </Button>
      </div>
    </section>
  );
}
