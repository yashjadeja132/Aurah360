import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Beaker } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useProtocols, useCreateProtocol } from '../hooks/useTreatmentPlans';
import { CATEGORY_OPTIONS } from '../constants';
import { PERMISSIONS } from '@/constants/rbac';

/** Protocols tab of the Treatments hub — extracted from the former `ProtocolLibraryPage`. */
export function ProtocolLibraryPanel() {
  const { t } = useTranslation();
  const { data: protocols = [], isLoading } = useProtocols();
  const create = useCreateProtocol();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'Other',
    clinicalGoal: '',
    estimatedSessions: 4,
    estimatedDuration: '',
    procedureName: '',
    sessionCount: 4,
    deviceRequired: '',
    consumables: '',
    preInstructions: '',
    postInstructions: '',
  });

  const submit = async () => {
    if (!form.name || !form.procedureName) return;
    await create.mutateAsync({
      name: form.name,
      category: form.category,
      clinicalGoal: form.clinicalGoal || null,
      estimatedSessions: Number(form.estimatedSessions) || 1,
      estimatedDuration: form.estimatedDuration || null,
      items: [
        {
          procedureName: form.procedureName,
          sessionCount: Number(form.sessionCount) || 1,
          sessionDuration: 30,
          deviceRequired: form.deviceRequired || null,
          consumables: form.consumables
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
          preInstructions: form.preInstructions || null,
          postInstructions: form.postInstructions || null,
          technicianRequired: true,
        },
      ],
    });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t(
            'treatmentPlans.protocolLibrary.subtitle',
            'Predefined protocols auto-fill sessions, instructions, devices, and consumables.'
          )}
        </p>
        <PermissionGuard
          permissions={[
            PERMISSIONS.TREATMENT_PLAN_CREATE,
            PERMISSIONS.TREATMENT_PLAN_EDIT,
            PERMISSIONS.TREATMENT_PLAN_ALL,
          ]}
        >
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            {t('treatmentPlans.protocolLibrary.newProtocol', 'New protocol')}
          </Button>
        </PermissionGuard>
      </div>

      {showForm && (
        <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
          <div>
            <Label>{t('treatmentPlans.protocolLibrary.name', 'Name')}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>{t('treatmentPlans.protocolLibrary.category', 'Category')}</Label>
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>{t('treatmentPlans.protocolLibrary.clinicalGoal', 'Clinical goal')}</Label>
            <Input
              value={form.clinicalGoal}
              onChange={(e) => setForm({ ...form, clinicalGoal: e.target.value })}
            />
          </div>
          <div>
            <Label>{t('treatmentPlans.protocolLibrary.procedureName', 'Procedure name')}</Label>
            <Input
              value={form.procedureName}
              onChange={(e) => setForm({ ...form, procedureName: e.target.value })}
            />
          </div>
          <div>
            <Label>{t('treatmentPlans.protocolLibrary.sessions', 'Sessions')}</Label>
            <Input
              type="number"
              value={form.sessionCount}
              onChange={(e) => setForm({ ...form, sessionCount: e.target.value })}
            />
          </div>
          <div>
            <Label>{t('treatmentPlans.protocolLibrary.device', 'Device')}</Label>
            <Input
              value={form.deviceRequired}
              onChange={(e) => setForm({ ...form, deviceRequired: e.target.value })}
            />
          </div>
          <div>
            <Label>{t('treatmentPlans.protocolLibrary.consumables', 'Consumables')}</Label>
            <Input
              value={form.consumables}
              onChange={(e) => setForm({ ...form, consumables: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={submit} disabled={create.isPending}>
              {t('treatmentPlans.protocolLibrary.saveProtocol', 'Save protocol')}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {protocols.map((p) => (
          <div key={p.id} className="rounded-xl border p-3">
            <p className="font-medium">
              {p.name} <span className="text-xs text-muted-foreground">({p.protocolCode})</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t('treatmentPlans.protocolLibrary.summaryLine', {
                defaultValue: '{{category}} · {{sessions}} sessions · {{procedures}} procedures',
                category: p.category,
                sessions: p.estimatedSessions,
                procedures: p.items?.length || 0,
              })}
            </p>
            <p className="mt-1 text-sm">{p.clinicalGoal}</p>
          </div>
        ))}
        {!protocols.length && !isLoading && (
          <EmptyState
            icon={Beaker}
            title={t('treatmentPlans.protocolLibrary.emptyState', 'No protocols yet.')}
            description={t(
              'treatmentPlans.protocolLibrary.emptyHint',
              'Create a protocol so plans and sessions can be auto-filled from it.'
            )}
          />
        )}
      </div>
    </div>
  );
}

export default ProtocolLibraryPanel;
