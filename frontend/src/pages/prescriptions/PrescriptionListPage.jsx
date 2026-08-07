import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Pill } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import {
  useDoctorPrescriptions,
  useCreatePrescription,
  useDuplicatePrescription,
  useDeletePrescription,
  usePrescriptionTemplates,
  useApplyTemplate,
} from '@/modules/prescriptions/hooks/usePrescriptions';
import { PRESCRIPTION_STATUS_LABELS } from '@/modules/prescriptions/constants';
import { prescriptionEditPath, prescriptionPrintPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

export default function PrescriptionListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const consultationId = searchParams.get('consultationId') || '';

  const { data: doctorsData } = useDoctorList({ limit: 50 });
  const doctors = doctorsData?.items || [];
  const [doctorId, setDoctorId] = useState('');
  const effectiveDoctorId = doctorId || doctors[0]?.id || '';

  const { data: prescriptions = [], isLoading } = useDoctorPrescriptions(effectiveDoctorId);
  const { data: templates = [] } = usePrescriptionTemplates(effectiveDoctorId);
  const create = useCreatePrescription();
  const duplicate = useDuplicatePrescription();
  const remove = useDeletePrescription();
  const applyTemplate = useApplyTemplate();

  const [newConsultationId, setNewConsultationId] = useState(consultationId);

  const startBlank = async () => {
    if (!newConsultationId) return;
    const res = await create.mutateAsync({
      consultationId: newConsultationId,
      items: [{ medicineName: 'Placeholder — replace via search', route: 'ORAL' }],
    });
    const id = res?.data?.prescription?.id;
    if (id) navigate(prescriptionEditPath(id));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('prescriptions.list.title', 'Prescriptions')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('prescriptions.list.subtitle', 'Always linked to a consultation — no inventory or billing.')}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={effectiveDoctorId} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">{t('prescriptions.list.selectDoctor', 'Select doctor')}</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.doctorCode} — {d.user?.fullName || t('prescriptions.list.doctorFallback', 'Doctor')}
            </option>
          ))}
        </Select>
        <Input
          placeholder={t('prescriptions.list.consultationIdPlaceholder', 'Consultation ID to create Rx…')}
          value={newConsultationId}
          onChange={(e) => setNewConsultationId(e.target.value)}
        />
        <PermissionGuard permissions={[PERMISSIONS.PRESCRIPTION_CREATE, PERMISSIONS.PRESCRIPTION_ALL]}>
          <Button onClick={startBlank} disabled={!newConsultationId || create.isPending}>
            <Plus className="h-4 w-4" />
            {t('prescriptions.list.newDraft', 'New draft')}
          </Button>
        </PermissionGuard>
      </div>

      {templates.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">{t('prescriptions.list.favoritesTemplates', 'Favorites / templates')}</h2>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant="outline"
                disabled={!newConsultationId || applyTemplate.isPending}
                onClick={async () => {
                  if (!newConsultationId) return;
                  const res = await applyTemplate.mutateAsync({
                    templateId: t.id,
                    consultationId: newConsultationId,
                  });
                  const id = res?.data?.prescription?.id;
                  if (id) navigate(prescriptionEditPath(id));
                }}
              >
                {t.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">{t('prescriptions.list.loading', 'Loading…')}</p>}
        {prescriptions.map((rx) => (
          <div
            key={rx.id}
            className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <Pill className="h-4 w-4 text-primary" />
              <div>
                <p className="font-medium">
                  {rx.prescriptionNumber} · {rx.patient?.fullName || t('prescriptions.list.patientFallback', 'Patient')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('prescriptions.list.medicinesCount', '{{count}} medicines', { count: rx.items?.length || 0 })} ·{' '}
                  {rx.createdAt ? new Date(rx.createdAt).toLocaleString() : '—'}
                </p>
              </div>
              <Badge variant={rx.status === 'FINALIZED' ? 'success' : 'warning'}>
                {PRESCRIPTION_STATUS_LABELS[rx.status] || rx.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={prescriptionEditPath(rx.id)}>{t('prescriptions.list.open', 'Open')}</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={prescriptionPrintPath(rx.id)}>{t('prescriptions.list.print', 'Print')}</Link>
              </Button>
              <PermissionGuard permissions={[PERMISSIONS.PRESCRIPTION_CREATE, PERMISSIONS.PRESCRIPTION_ALL]}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const res = await duplicate.mutateAsync(rx.id);
                    const id = res?.data?.prescription?.id;
                    if (id) navigate(prescriptionEditPath(id));
                  }}
                >
                  {t('prescriptions.list.duplicate', 'Duplicate')}
                </Button>
              </PermissionGuard>
              {rx.status === 'DRAFT' && (
                <PermissionGuard permissions={[PERMISSIONS.PRESCRIPTION_EDIT, PERMISSIONS.PRESCRIPTION_ALL]}>
                  <Button size="sm" variant="ghost" onClick={() => remove.mutate(rx.id)}>
                    {t('prescriptions.list.delete', 'Delete')}
                  </Button>
                </PermissionGuard>
              )}
            </div>
          </div>
        ))}
        {!prescriptions.length && !isLoading && (
          <p className="text-sm text-muted-foreground">{t('prescriptions.list.emptyState', 'No prescriptions yet.')}</p>
        )}
      </div>
    </section>
  );
}
