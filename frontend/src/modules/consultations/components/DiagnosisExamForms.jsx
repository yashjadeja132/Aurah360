import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSaveDiagnosis, useSaveExamination } from '../hooks/useConsultations';
import { useInsertTarget } from '../hooks/useInsertTarget';
import { INSERT_TARGETS, appendCsv, appendText } from '../insertBus';

export function DiagnosisForm({ consultationId, diagnosis, readOnly }) {
  const { t } = useTranslation();
  const save = useSaveDiagnosis(consultationId);
  const [form, setForm] = useState({
    primaryDiagnosis: '',
    secondaryDiagnoses: '',
    clinicalNotes: '',
    icd10Codes: '',
  });

  /** Hydrate once per consultation — a refetch must not wipe unsaved or AI-inserted edits. */
  const hydratedFor = useRef(null);
  useEffect(() => {
    if (hydratedFor.current === consultationId) return;
    hydratedFor.current = consultationId;
    setForm({
      primaryDiagnosis: diagnosis?.primaryDiagnosis || '',
      secondaryDiagnoses: (diagnosis?.secondaryDiagnoses || []).join(', '),
      clinicalNotes: diagnosis?.clinicalNotes || '',
      icd10Codes: (diagnosis?.icd10Codes || []).join(', '),
    });
  }, [diagnosis, consultationId]);

  /**
   * A copilot condition accepted by the doctor fills the primary field when it is still empty,
   * otherwise it joins the secondary list. The model's reasoning is appended to clinical notes,
   * explicitly marked as an unverified AI suggestion. Nothing is saved until the doctor presses
   * Save diagnosis.
   */
  useInsertTarget(
    INSERT_TARGETS.DIAGNOSIS,
    ({ condition, reasoning, likelihood }) => {
      if (!condition) return;
      setForm((prev) => {
        const next = { ...prev };
        if (!prev.primaryDiagnosis.trim()) next.primaryDiagnosis = condition;
        else next.secondaryDiagnoses = appendCsv(prev.secondaryDiagnoses, condition);
        if (reasoning) {
          next.clinicalNotes = appendText(
            prev.clinicalNotes,
            `${t('consultations.diagnosis.aiNotePrefix', 'AI suggestion (verify)')} — ${condition}${
              likelihood ? ` [${likelihood}]` : ''
            }: ${reasoning}`
          );
        }
        return next;
      });
    },
    !readOnly
  );

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{t('consultations.diagnosis.title', 'Diagnosis')}</h3>
      <div className="space-y-1">
        <Label>{t('consultations.diagnosis.primary', 'Primary')}</Label>
        <Input
          value={form.primaryDiagnosis}
          disabled={readOnly}
          onChange={(e) => setForm((p) => ({ ...p, primaryDiagnosis: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label>{t('consultations.diagnosis.secondary', 'Secondary (comma-separated)')}</Label>
        <Input
          value={form.secondaryDiagnoses}
          disabled={readOnly}
          onChange={(e) => setForm((p) => ({ ...p, secondaryDiagnoses: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label>{t('consultations.diagnosis.icd10', 'ICD-10 (placeholder, comma-separated)')}</Label>
        <Input
          value={form.icd10Codes}
          disabled={readOnly}
          onChange={(e) => setForm((p) => ({ ...p, icd10Codes: e.target.value }))}
        />
      </div>
      <div className="space-y-1">
        <Label>{t('consultations.diagnosis.clinicalNotes', 'Clinical notes')}</Label>
        <textarea
          className="min-h-[80px] w-full rounded-lg border px-3 py-2 text-sm"
          value={form.clinicalNotes}
          disabled={readOnly}
          onChange={(e) => setForm((p) => ({ ...p, clinicalNotes: e.target.value }))}
        />
      </div>
      {!readOnly && (
        <Button
          disabled={save.isPending}
          onClick={() =>
            save.mutate({
              primaryDiagnosis: form.primaryDiagnosis || null,
              secondaryDiagnoses: form.secondaryDiagnoses
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              clinicalNotes: form.clinicalNotes || null,
              icd10Codes: form.icd10Codes
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        >
          {t('consultations.diagnosis.save', 'Save diagnosis')}
        </Button>
      )}
    </div>
  );
}

const EXAM_FIELDS = [
  { key: 'generalExamination', tKey: 'general', label: 'General' },
  { key: 'skinExamination', tKey: 'skin', label: 'Skin' },
  { key: 'hairExamination', tKey: 'hair', label: 'Hair' },
  { key: 'scalpExamination', tKey: 'scalp', label: 'Scalp' },
  { key: 'laserAssessment', tKey: 'laserAssessment', label: 'Laser assessment' },
  { key: 'clinicalFindings', tKey: 'clinicalFindings', label: 'Clinical findings' },
];

export function ExaminationForm({ consultationId, examination, readOnly }) {
  const { t } = useTranslation();
  const save = useSaveExamination(consultationId);
  const [form, setForm] = useState({});

  useEffect(() => {
    setForm(examination || {});
  }, [examination]);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{t('consultations.examination.title', 'Examination')}</h3>
      {EXAM_FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label>{t(`consultations.examination.fields.${f.tKey}`, f.label)}</Label>
          <textarea
            className="min-h-[72px] w-full rounded-lg border px-3 py-2 text-sm"
            value={form[f.key] || ''}
            disabled={readOnly}
            onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
          />
        </div>
      ))}
      {!readOnly && (
        <Button disabled={save.isPending} onClick={() => save.mutate(form)}>
          {t('consultations.examination.save', 'Save examination')}
        </Button>
      )}
    </div>
  );
}
