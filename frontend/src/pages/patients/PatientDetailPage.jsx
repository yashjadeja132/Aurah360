import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PatientDocumentsPanel } from '@/modules/patients/components/PatientDocumentsPanel';
import { PatientTimelinePanel } from '@/modules/patients/components/PatientTimelinePanel';
import { PatientLoyaltyPanel } from '@/modules/patients/components/PatientLoyaltyPanel';
import { PatientBillingPanel } from '@/modules/patients/components/PatientBillingPanel';
import { PatientAppointmentsPanel } from '@/modules/patients/components/PatientAppointmentsPanel';
import { PatientPrescriptionsPanel } from '@/modules/patients/components/PatientPrescriptionsPanel';
import { PatientTreatmentsPanel } from '@/modules/patients/components/PatientTreatmentsPanel';
import { PatientPhotosPanel } from '@/modules/patients/components/PatientPhotosPanel';
import { HandoffNotePanel } from '@/modules/handoff/components/HandoffNotePanel';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissions';
import { usePatientDetail, usePatientMutations } from '@/modules/patients/hooks/usePatients';
import { APP_ROUTES, patientEditPath, appointmentPatientHistoryPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';

export default function PatientDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Deep-link support (e.g. `?tab=documents` from the reception desk's "Upload report" shortcut) —
  // falls back to Overview for any unrecognised/absent value.
  const [tab, setTab] = useState(searchParams.get('tab') || 'overview');
  const { data: patient, isLoading, isError } = usePatientDetail(id);
  const { remove, updateConsent } = usePatientMutations();
  const { user } = useAuth();
  const canViewLoyalty = hasAnyPermission(user?.permissions, [
    PERMISSIONS.LOYALTY_BALANCE_VIEW,
    PERMISSIONS.LOYALTY_ALL,
  ]);
  const canViewAppointments = hasAnyPermission(user?.permissions, [
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_ALL,
  ]);
  const canViewBilling = hasAnyPermission(user?.permissions, [
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_ALL,
  ]);
  const canViewPrescriptions = hasAnyPermission(user?.permissions, [
    PERMISSIONS.PRESCRIPTION_VIEW,
    PERMISSIONS.PRESCRIPTION_ALL,
  ]);
  const canViewTreatments = hasAnyPermission(user?.permissions, [
    PERMISSIONS.TREATMENT_PLAN_VIEW,
    PERMISSIONS.TREATMENT_PLAN_ALL,
  ]);
  // Clinical photos live on the consultation record and are read through the consultation API,
  // so the photos tab is gated on the same permission that endpoint requires.
  const canViewPhotos = hasAnyPermission(user?.permissions, [
    PERMISSIONS.CONSULTATION_VIEW,
    PERMISSIONS.CONSULTATION_ALL,
  ]);

  const TABS = [
    { id: 'overview', label: t('patients.detail.tabs.overview', 'Overview') },
    { id: 'medical', label: t('patients.detail.tabs.medical', 'Medical') },
    { id: 'documents', label: t('patients.detail.tabs.documents', 'Documents') },
    { id: 'timeline', label: t('patients.detail.tabs.timeline', 'Timeline') },
    ...(canViewAppointments
      ? [{ id: 'appointments', label: t('patients.detail.tabs.appointments', 'Appointments') }]
      : []),
    ...(canViewBilling
      ? [{ id: 'billing', label: t('patients.detail.tabs.billing', 'Billing') }]
      : []),
    ...(canViewPrescriptions
      ? [{ id: 'prescriptions', label: t('patients.detail.tabs.prescriptions', 'Prescriptions') }]
      : []),
    ...(canViewTreatments
      ? [{ id: 'treatments', label: t('patients.detail.tabs.treatments', 'Treatments') }]
      : []),
    ...(canViewPhotos
      ? [{ id: 'photos', label: t('patients.detail.tabs.photos', 'Photos') }]
      : []),
    { id: 'handoff', label: t('patients.detail.tabs.handoff', 'Handoff notes') },
    ...(canViewLoyalty
      ? [{ id: 'loyalty', label: t('patients.detail.tabs.loyalty', 'Loyalty') }]
      : []),
  ];

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !patient) return <p className="text-destructive">{t('patients.detail.notFound', 'Patient not found.')}</p>;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to={APP_ROUTES.PATIENTS}>← {t('nav.patients', 'Patients')}</Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-lg font-semibold">
              {(patient.firstName?.[0] || '?')}{(patient.lastName?.[0] || '')}
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold text-primary">
                {patient.fullName}
                {patient.isVip && <Badge className="ml-2" variant="warning">{t('patients.detail.vip', 'VIP')}</Badge>}
              </h1>
              <p className="mt-1 font-mono text-sm text-muted-foreground">
                {patient.mrn} · {patient.patientCode}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionGuard permissions={[PERMISSIONS.PATIENTS_EDIT, PERMISSIONS.PATIENTS_ALL]}>
            <Button asChild variant="outline">
              <Link to={patientEditPath(id)}>{t('common.edit', 'Edit')}</Link>
            </Button>
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_ALL]}>
            <Button asChild variant="outline">
              <Link to={appointmentPatientHistoryPath(id)}>{t('nav.appointments', 'Appointments')}</Link>
            </Button>
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.PATIENTS_DELETE, PERMISSIONS.PATIENTS_ALL]}>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!window.confirm(t('patients.detail.deleteConfirm', 'Soft-delete this patient?'))) return;
                await remove.mutateAsync(id);
                toast.success(t('patients.detail.deleteSuccess', 'Patient deleted'));
                navigate(APP_ROUTES.PATIENTS);
              }}
            >
              {t('common.delete', 'Delete')}
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border pb-px">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => setTab(tb.id)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
              tab === tb.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>{t('patients.detail.contact', 'Contact')}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label={t('patients.detail.mobile', 'Mobile')} value={patient.mobile} />
              <Row label={t('patients.detail.email', 'Email')} value={patient.email || '—'} />
              <Row label={t('patients.detail.ageGender', 'Age / Gender')} value={`${patient.age ?? '—'} · ${patient.gender}`} />
              <Row label={t('patients.detail.bloodGroup', 'Blood group')} value={patient.bloodGroup || '—'} />
              <Row
                label={t('patients.detail.address', 'Address')}
                value={[
                  patient.address?.addressLine1,
                  patient.address?.city,
                  patient.address?.state,
                ].filter(Boolean).join(', ') || '—'}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t('patients.detail.clinic', 'Clinic')}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label={t('patients.detail.branch', 'Branch')} value={patient.primaryBranch?.name || '—'} />
              <Row label={t('patients.detail.doctor', 'Doctor')} value={patient.primaryDoctor?.name || '—'} />
              <Row label={t('patients.detail.leadSource', 'Lead source')} value={patient.leadSource?.name || '—'} />
              <Row label={t('patients.detail.status', 'Status')} value={<Badge variant={patient.isActive ? 'success' : 'warning'}>{patient.status}</Badge>} />
              <Row label={t('patients.detail.tags', 'Tags')} value={(patient.tags || []).join(', ') || '—'} />
              <Row
                label={t('patients.detail.registered', 'Registered')}
                value={patient.registrationDate ? new Date(patient.registrationDate).toLocaleDateString() : '—'}
              />
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>{t('patients.detail.consents', 'Consents')}</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {[
                ['privacyPolicy', t('patients.form.consentPrivacy', 'Privacy policy')],
                ['treatmentConsent', t('patients.form.consentTreatment', 'Treatment consent')],
                ['photographyConsent', t('patients.form.consentPhotography', 'Photography consent')],
                ['marketingConsent', t('patients.form.consentMarketing', 'Marketing consent')],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(patient.consent?.[key])}
                    onChange={async (e) => {
                      try {
                        await updateConsent.mutateAsync({
                          id,
                          payload: { [key]: e.target.checked },
                        });
                        toast.success(t('patients.detail.consentUpdated', 'Consent updated'));
                      } catch (err) {
                        toast.error(err?.response?.data?.message || t('common.failed', 'Failed'));
                      }
                    }}
                  />
                  {label}
                </label>
              ))}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {t('patients.detail.eSignPlaceholder', 'E-sign placeholder: {{value}}', {
                  value: patient.consent?.eSignPlaceholder || t('patients.detail.notCaptured', 'Not captured'),
                })}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'medical' && (
        <Card>
          <CardHeader><CardTitle>{t('patients.detail.medicalInfo', 'Medical information')}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
            <Row label={t('patients.form.height', 'Height')} value={patient.medical?.heightCm ? `${patient.medical.heightCm} cm` : '—'} />
            <Row label={t('patients.form.weight', 'Weight')} value={patient.medical?.weightKg ? `${patient.medical.weightKg} kg` : '—'} />
            <Row label={t('patients.detail.bmi', 'BMI')} value={patient.medical?.bmi ?? '—'} />
            <Row label={t('patients.form.allergies', 'Allergies')} value={patient.medical?.allergies || '—'} />
            <Row label={t('patients.form.chronicDiseases', 'Chronic diseases')} value={patient.medical?.chronicDiseases || '—'} />
            <Row label={t('patients.detail.medications', 'Medications')} value={patient.medical?.currentMedications || '—'} />
            <Row label={t('patients.detail.pastMedical', 'Past medical')} value={patient.medical?.pastMedicalHistory || '—'} />
            <Row label={t('patients.detail.pastSurgical', 'Past surgical')} value={patient.medical?.pastSurgicalHistory || '—'} />
            <Row label={t('patients.form.smoking', 'Smoking')} value={patient.medical?.smoking || '—'} />
            <Row label={t('patients.form.alcohol', 'Alcohol')} value={patient.medical?.alcohol || '—'} />
            <Row label={t('patients.detail.pregnancy', 'Pregnancy')} value={patient.medical?.pregnancyStatus || '—'} />
            <Row label={t('common.notes', 'Notes')} value={patient.medical?.generalNotes || '—'} />
          </CardContent>
        </Card>
      )}

      {tab === 'documents' && <PatientDocumentsPanel patientId={id} />}
      {tab === 'timeline' && <PatientTimelinePanel patientId={id} />}
      {tab === 'appointments' && canViewAppointments && <PatientAppointmentsPanel patientId={id} />}
      {tab === 'billing' && canViewBilling && <PatientBillingPanel patientId={id} />}
      {tab === 'prescriptions' && canViewPrescriptions && <PatientPrescriptionsPanel patientId={id} />}
      {tab === 'treatments' && canViewTreatments && <PatientTreatmentsPanel patientId={id} />}
      {tab === 'photos' && canViewPhotos && <PatientPhotosPanel patientId={id} />}
      {tab === 'handoff' && <HandoffNotePanel patientId={id} branchId={patient.primaryBranchId} />}
      {tab === 'loyalty' && canViewLoyalty && <PatientLoyaltyPanel patientId={id} />}
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
