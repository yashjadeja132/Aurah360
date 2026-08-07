import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSaveVitals } from '../hooks/useConsultations';

const FIELD_KEYS = [
  { key: 'heightCm', tKey: 'heightCm', label: 'Height (cm)' },
  { key: 'weightKg', tKey: 'weightKg', label: 'Weight (kg)' },
  { key: 'bmi', tKey: 'bmi', label: 'BMI', readOnly: true },
  { key: 'temperatureC', tKey: 'temperatureC', label: 'Temp (°C)' },
  { key: 'pulseBpm', tKey: 'pulseBpm', label: 'Pulse' },
  { key: 'bloodPressureSystolic', tKey: 'bpSystolic', label: 'BP systolic' },
  { key: 'bloodPressureDiastolic', tKey: 'bpDiastolic', label: 'BP diastolic' },
  { key: 'respirationRpm', tKey: 'respiration', label: 'Respiration' },
  { key: 'oxygenSaturation', tKey: 'oxygenSaturation', label: 'SpO₂ %' },
  { key: 'painScale', tKey: 'painScale', label: 'Pain (0–10)' },
];

export function VitalsForm({ consultationId, vitals, readOnly }) {
  const { t } = useTranslation();
  const save = useSaveVitals(consultationId);
  const [form, setForm] = useState({});

  useEffect(() => {
    setForm(vitals || {});
  }, [vitals]);

  const onChange = (key) => (e) => {
    const value = e.target.value === '' ? null : Number(e.target.value);
    setForm((p) => ({ ...p, [key]: value }));
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">{t('consultations.vitals.title', 'Vitals')}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELD_KEYS.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label>{t(`consultations.vitals.fields.${f.tKey}`, f.label)}</Label>
            <Input
              type="number"
              value={form[f.key] ?? ''}
              onChange={onChange(f.key)}
              disabled={readOnly || f.readOnly}
            />
          </div>
        ))}
      </div>
      {!readOnly && (
        <Button
          onClick={() => save.mutate(form)}
          disabled={save.isPending}
        >
          {t('consultations.vitals.save', 'Save vitals')}
        </Button>
      )}
    </div>
  );
}
