import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { MedicineSearchInput } from './MedicineSearchInput';
import { DURATION_CHIPS, FREQUENCY_CHIPS, ROUTE_OPTIONS, emptyItem } from '../constants';

export function PrescriptionItemEditor({ items, onChange, readOnly }) {
  const { t } = useTranslation();
  const updateItem = (index, patch) => {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    onChange(next);
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = (med = null) => {
    const base = emptyItem();
    if (med) {
      base.medicineId = med.id;
      base.medicineName = med.name;
      base.genericName = med.genericName || '';
      base.strength = med.strength || '';
      base.route = med.defaultRoute || 'ORAL';
    }
    onChange([...items, base]);
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="space-y-2">
          <Label>{t('prescriptions.itemEditor.addMedicine', 'Add medicine')}</Label>
          <MedicineSearchInput onSelect={(m) => addItem(m)} />
          <Button type="button" variant="outline" size="sm" onClick={() => addItem()}>
            {t('prescriptions.itemEditor.addBlankRow', 'Add blank row')}
          </Button>
        </div>
      )}

      {items.map((item, index) => (
        <div key={index} className="space-y-3 rounded-xl border p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{item.medicineName || t('prescriptions.itemEditor.untitledMedicine', 'Untitled medicine')}</p>
              <p className="text-xs text-muted-foreground">
                {[item.genericName, item.strength].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            {!readOnly && (
              <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(index)}>
                {t('prescriptions.itemEditor.remove', 'Remove')}
              </Button>
            )}
          </div>

          {!item.medicineName && !readOnly && (
            <Input
              placeholder={t('prescriptions.itemEditor.medicineNamePlaceholder', 'Medicine name')}
              value={item.medicineName}
              onChange={(e) => updateItem(index, { medicineName: e.target.value })}
            />
          )}

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('prescriptions.itemEditor.dosage', 'Dosage')}>
              <Input
                value={item.dosage || ''}
                disabled={readOnly}
                onChange={(e) => updateItem(index, { dosage: e.target.value })}
                placeholder={t('prescriptions.itemEditor.dosagePlaceholder', '1 tablet / pea size')}
              />
            </Field>
            <Field label={t('prescriptions.itemEditor.route', 'Route')}>
              <Select
                value={item.route || 'ORAL'}
                disabled={readOnly}
                onChange={(e) => updateItem(index, { route: e.target.value })}
              >
                {ROUTE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('prescriptions.itemEditor.frequency', 'Frequency')}>
              <Input
                value={item.frequency || ''}
                disabled={readOnly}
                onChange={(e) => updateItem(index, { frequency: e.target.value })}
              />
            </Field>
            <Field label={t('prescriptions.itemEditor.duration', 'Duration')}>
              <Input
                value={item.duration || ''}
                disabled={readOnly}
                onChange={(e) => updateItem(index, { duration: e.target.value })}
              />
            </Field>
          </div>

          {!readOnly && (
            <div className="flex flex-wrap gap-1">
              {FREQUENCY_CHIPS.map((f) => (
                <Chip key={f} active={item.frequency === f} onClick={() => updateItem(index, { frequency: f })}>
                  {f}
                </Chip>
              ))}
              {DURATION_CHIPS.map((d) => (
                <Chip key={d} active={item.duration === d} onClick={() => updateItem(index, { duration: d })}>
                  {d}
                </Chip>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-sm">
            {[
              ['morning', t('prescriptions.itemEditor.morning', 'Morning')],
              ['afternoon', t('prescriptions.itemEditor.afternoon', 'Afternoon')],
              ['night', t('prescriptions.itemEditor.night', 'Night')],
              ['beforeFood', t('prescriptions.itemEditor.beforeFood', 'Before food')],
              ['afterFood', t('prescriptions.itemEditor.afterFood', 'After food')],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={Boolean(item[key])}
                  disabled={readOnly}
                  onChange={(e) => updateItem(index, { [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t('prescriptions.itemEditor.quantity', 'Quantity')}>
              <Input
                type="number"
                value={item.quantity ?? ''}
                disabled={readOnly}
                onChange={(e) =>
                  updateItem(index, {
                    quantity: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label={t('prescriptions.itemEditor.instructions', 'Instructions')}>
              <Input
                value={item.instructions || ''}
                disabled={readOnly}
                onChange={(e) => updateItem(index, { instructions: e.target.value })}
              />
            </Field>
          </div>
        </div>
      ))}

      {!items.length && (
        <p className="text-sm text-muted-foreground">{t('prescriptions.itemEditor.emptyState', 'No medicines added yet.')}</p>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Chip({ children, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-0.5 text-xs ${
        active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}
