import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Printer, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PrescriptionItemEditor } from '@/modules/prescriptions/components/PrescriptionItemEditor';
import {
  usePrescription,
  useUpdatePrescription,
  useFinalizePrescription,
  useCreateTemplate,
  useRecentMedicines,
} from '@/modules/prescriptions/hooks/usePrescriptions';
import { PRESCRIPTION_STATUS_LABELS, emptyItem } from '@/modules/prescriptions/constants';
import { APP_ROUTES, prescriptionPrintPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

export default function PrescriptionEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: rx, isLoading, isError, error } = usePrescription(id);
  const update = useUpdatePrescription(id);
  const finalize = useFinalizePrescription(id);
  const saveTemplate = useCreateTemplate();
  const { data: recent = [] } = useRecentMedicines(rx?.doctorId);

  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (rx) {
      setNotes(rx.notes || '');
      setItems(
        (rx.items || []).map((it) => ({
          ...emptyItem(),
          ...it,
          medicineId: it.medicineId || '',
          quantity: it.quantity ?? '',
        }))
      );
    }
  }, [rx?.id]);

  const readOnly = rx?.status === 'FINALIZED' || rx?.status === 'CANCELLED';

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">{t('prescriptions.editor.loading', 'Loading…')}</p>;
  if (isError || !rx) {
    return (
      <p className="p-6 text-sm text-destructive">
        {error?.response?.data?.message || t('prescriptions.editor.notFound', 'Prescription not found')}
      </p>
    );
  }

  const payloadItems = () =>
    items.map((it) => ({
      ...it,
      medicineId: it.medicineId || null,
      quantity: it.quantity === '' ? null : it.quantity,
    }));

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to={APP_ROUTES.PRESCRIPTIONS}>
              <ArrowLeft className="h-4 w-4" />
              {t('prescriptions.editor.back', 'Back')}
            </Link>
          </Button>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-primary">
              {rx.prescriptionNumber}
            </h1>
            <Badge variant={readOnly ? 'success' : 'warning'}>
              {PRESCRIPTION_STATUS_LABELS[rx.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {rx.patient?.fullName} · {t('prescriptions.editor.doctorPrefix', 'Dr.')} {rx.doctor?.name || '—'} ·{' '}
            {rx.consultation?.consultationNumber}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <>
              <PermissionGuard permissions={[PERMISSIONS.PRESCRIPTION_EDIT, PERMISSIONS.PRESCRIPTION_ALL]}>
                <Button
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ notes, items: payloadItems() })}
                >
                  {t('prescriptions.editor.saveDraft', 'Save draft')}
                </Button>
              </PermissionGuard>
              <PermissionGuard
                permissions={[PERMISSIONS.PRESCRIPTION_FINALIZE, PERMISSIONS.PRESCRIPTION_ALL]}
              >
                <Button
                  disabled={finalize.isPending || items.length === 0}
                  onClick={async () => {
                    await update.mutateAsync({ notes, items: payloadItems() });
                    await finalize.mutateAsync();
                  }}
                >
                  <Check className="h-4 w-4" />
                  {t('prescriptions.editor.finalize', 'Finalize')}
                </Button>
              </PermissionGuard>
            </>
          )}
          <PermissionGuard permissions={[PERMISSIONS.PRESCRIPTION_PRINT, PERMISSIONS.PRESCRIPTION_ALL]}>
            <Button asChild variant="outline">
              <Link to={prescriptionPrintPath(id)}>
                <Printer className="h-4 w-4" />
                {t('prescriptions.editor.print', 'Print')}
              </Link>
            </Button>
          </PermissionGuard>
          {!readOnly && (
            <PermissionGuard permissions={[PERMISSIONS.PRESCRIPTION_CREATE, PERMISSIONS.PRESCRIPTION_ALL]}>
              <Button
                variant="outline"
                onClick={() =>
                  saveTemplate.mutate({
                    doctorId: rx.doctorId,
                    name: `${t('prescriptions.editor.favoriteNamePrefix', 'Favorite')} ${rx.prescriptionNumber}`,
                    isFavorite: true,
                    items: payloadItems(),
                    notes,
                  })
                }
              >
                <Star className="h-4 w-4" />
                {t('prescriptions.editor.saveFavorite', 'Save favorite')}
              </Button>
            </PermissionGuard>
          )}
        </div>
      </div>

      {recent.length > 0 && !readOnly && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">{t('prescriptions.editor.recentMedicines', 'Recent medicines')}</h2>
          <div className="flex flex-wrap gap-2">
            {recent.slice(0, 8).map((m) => (
              <button
                key={`${m.medicineId}-${m.medicineName}`}
                type="button"
                className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    {
                      ...emptyItem(),
                      medicineId: m.medicineId || '',
                      medicineName: m.medicineName,
                      dosage: m.sample?.dosage || '',
                      frequency: m.sample?.frequency || '',
                      duration: m.sample?.duration || '',
                      route: m.sample?.route || 'ORAL',
                      morning: m.sample?.morning,
                      afternoon: m.sample?.afternoon,
                      night: m.sample?.night,
                      beforeFood: m.sample?.beforeFood,
                      afterFood: m.sample?.afterFood,
                    },
                  ])
                }
              >
                {m.medicineName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>{t('prescriptions.editor.notesLabel', 'Notes')}</Label>
        <Input
          value={notes}
          disabled={readOnly}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('prescriptions.editor.notesPlaceholder', 'Prescription notes')}
        />
      </div>

      <PrescriptionItemEditor items={items} onChange={setItems} readOnly={readOnly} />

      {readOnly && (
        <p className="text-sm text-muted-foreground">
          {t('prescriptions.editor.lockedNotice', 'Finalized prescriptions are locked. Duplicate to create a new draft.')}
        </p>
      )}
    </section>
  );
}
