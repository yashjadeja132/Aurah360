import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Boxes } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { usePackages, useCreatePackage, useProtocols } from '../hooks/useTreatmentPlans';
import { CATEGORY_OPTIONS } from '../constants';
import { PERMISSIONS } from '@/constants/rbac';

/** Packages tab of the Treatments hub — extracted from the former `PackageBuilderPage`. */
export function PackageBuilderPanel() {
  const { t } = useTranslation();
  const { data: packages = [], isLoading } = usePackages();
  const { data: protocols = [] } = useProtocols();
  const create = useCreatePackage();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'Other',
    packagePrice: '',
    discount: '0',
    validityDays: '90',
    maximumSessions: '4',
    protocolId: '',
  });

  const submit = async () => {
    if (!form.name || form.packagePrice === '') return;
    await create.mutateAsync({
      name: form.name,
      category: form.category,
      packagePrice: Number(form.packagePrice),
      discount: Number(form.discount) || 0,
      validityDays: Number(form.validityDays) || 90,
      maximumSessions: Number(form.maximumSessions) || 1,
      protocolId: form.protocolId || null,
    });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {t(
            'treatmentPlans.packageBuilder.subtitle',
            'Package pricing metadata only — no billing or invoices.'
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
            {t('treatmentPlans.packageBuilder.newPackage', 'New package')}
          </Button>
        </PermissionGuard>
      </div>

      {showForm && (
        <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
          <div>
            <Label>{t('treatmentPlans.packageBuilder.packageName', 'Package name')}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>{t('treatmentPlans.packageBuilder.category', 'Category')}</Label>
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
          <div>
            <Label>{t('treatmentPlans.packageBuilder.packagePrice', 'Package price')}</Label>
            <Input
              type="number"
              value={form.packagePrice}
              onChange={(e) => setForm({ ...form, packagePrice: e.target.value })}
            />
          </div>
          <div>
            <Label>{t('treatmentPlans.packageBuilder.discount', 'Discount')}</Label>
            <Input
              type="number"
              value={form.discount}
              onChange={(e) => setForm({ ...form, discount: e.target.value })}
            />
          </div>
          <div>
            <Label>{t('treatmentPlans.packageBuilder.validityDays', 'Validity (days)')}</Label>
            <Input
              type="number"
              value={form.validityDays}
              onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
            />
          </div>
          <div>
            <Label>{t('treatmentPlans.packageBuilder.maximumSessions', 'Maximum sessions')}</Label>
            <Input
              type="number"
              value={form.maximumSessions}
              onChange={(e) => setForm({ ...form, maximumSessions: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>
              {t('treatmentPlans.packageBuilder.linkedProtocol', 'Linked protocol (optional)')}
            </Label>
            <Select
              value={form.protocolId}
              onChange={(e) => setForm({ ...form, protocolId: e.target.value })}
            >
              <option value="">{t('treatmentPlans.packageBuilder.none', 'None')}</option>
              {protocols.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button onClick={submit} disabled={create.isPending}>
              {t('treatmentPlans.packageBuilder.savePackage', 'Save package')}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {packages.map((pkg) => (
          <div key={pkg.id} className="rounded-xl border p-3">
            <p className="font-medium">
              {pkg.name} <span className="text-xs text-muted-foreground">({pkg.packageCode})</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {t('treatmentPlans.packageBuilder.summaryLine', {
                defaultValue:
                  '₹{{price}} · discount ₹{{discount}} · {{sessions}} sessions · validity {{validity}}d · unused tracked on plan attach',
                price: pkg.packagePrice,
                discount: pkg.discount || 0,
                sessions: pkg.maximumSessions,
                validity: pkg.validityDays,
              })}
            </p>
          </div>
        ))}
        {!packages.length && !isLoading && (
          <EmptyState
            icon={Boxes}
            title={t('treatmentPlans.packageBuilder.emptyState', 'No packages yet.')}
            description={t(
              'treatmentPlans.packageBuilder.emptyHint',
              'Bundle a protocol into a package to track session balances on a plan.'
            )}
          />
        )}
      </div>
    </div>
  );
}

export default PackageBuilderPanel;
