import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { emptyItem } from '../constants';

export function PlanItemEditor({ items, onChange, readOnly }) {
  const { t } = useTranslation();
  const updateItem = (index, patch) => {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    onChange(next);
  };

  const removeItem = (index) => onChange(items.filter((_, i) => i !== index));

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={item.id || index} className="space-y-3 rounded-xl border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {t('treatmentPlans.planItemEditor.procedureNumber', {
                defaultValue: 'Procedure {{number}}',
                number: index + 1,
              })}
            </p>
            {!readOnly && (
              <Button type="button" size="sm" variant="ghost" onClick={() => removeItem(index)}>
                {t('treatmentPlans.planItemEditor.remove', 'Remove')}
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>{t('treatmentPlans.planItemEditor.procedureName', 'Procedure name')}</Label>
              <Input
                disabled={readOnly}
                value={item.procedureName || ''}
                onChange={(e) => updateItem(index, { procedureName: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('treatmentPlans.planItemEditor.sessions', 'Sessions')}</Label>
              <Input
                type="number"
                min={1}
                disabled={readOnly}
                value={item.sessionCount ?? 1}
                onChange={(e) => updateItem(index, { sessionCount: Number(e.target.value) || 1 })}
              />
            </div>
            <div>
              <Label>{t('treatmentPlans.planItemEditor.duration', 'Duration (min)')}</Label>
              <Input
                type="number"
                min={1}
                disabled={readOnly}
                value={item.sessionDuration ?? 30}
                onChange={(e) =>
                  updateItem(index, { sessionDuration: Number(e.target.value) || 30 })
                }
              />
            </div>
            <div>
              <Label>{t('treatmentPlans.planItemEditor.frequency', 'Frequency')}</Label>
              <Input
                disabled={readOnly}
                value={item.frequency || ''}
                onChange={(e) => updateItem(index, { frequency: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('treatmentPlans.planItemEditor.device', 'Device')}</Label>
              <Input
                disabled={readOnly}
                value={item.deviceRequired || ''}
                onChange={(e) => updateItem(index, { deviceRequired: e.target.value })}
              />
            </div>
            <div>
              <Label>{t('treatmentPlans.planItemEditor.room', 'Room')}</Label>
              <Input
                disabled={readOnly}
                value={item.roomRequired || ''}
                onChange={(e) => updateItem(index, { roomRequired: e.target.value })}
              />
            </div>
            <div>
              <Label>
                {t('treatmentPlans.planItemEditor.consumables', 'Consumables (comma-separated)')}
              </Label>
              <Input
                disabled={readOnly}
                value={
                  Array.isArray(item.consumables)
                    ? item.consumables.join(', ')
                    : item.consumables || ''
                }
                onChange={(e) => updateItem(index, { consumables: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>{t('treatmentPlans.planItemEditor.preInstructions', 'Pre-instructions')}</Label>
              <Input
                disabled={readOnly}
                value={item.preInstructions || ''}
                onChange={(e) => updateItem(index, { preInstructions: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>
                {t('treatmentPlans.planItemEditor.postInstructions', 'Post-instructions')}
              </Label>
              <Input
                disabled={readOnly}
                value={item.postInstructions || ''}
                onChange={(e) => updateItem(index, { postInstructions: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={item.technicianRequired !== false}
              onChange={(e) => updateItem(index, { technicianRequired: e.target.checked })}
            />
            {t('treatmentPlans.planItemEditor.technicianRequired', 'Technician required')}
          </label>
        </div>
      ))}
      {!readOnly && (
        <Button type="button" variant="outline" onClick={() => onChange([...items, emptyItem()])}>
          {t('treatmentPlans.planItemEditor.addProcedure', 'Add procedure')}
        </Button>
      )}
    </div>
  );
}

export default PlanItemEditor;
