import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { DraftIndicator } from './StatusBadges';
import { useIntake, useIntakeAutosave } from '../hooks/useConsultations';
import {
  INTAKE_CATEGORY_OPTIONS,
  DURATION_UNIT_OPTIONS,
  SKIN_TYPE_OPTIONS,
} from '../constants';

const EMPTY_FORM = {
  category: 'GENERAL',
  chiefComplaint: '',
  durationValue: '',
  durationUnit: '',
  bodyArea: '',
  allergies: '',
  allergiesReviewed: false,
  currentMedications: '',
  currentMedicationsReviewed: false,
  conditions: '',
  conditionsReviewed: false,
  pastTreatment: '',
  pastTreatmentReviewed: false,
  skinHistory: {
    skinType: '',
    photosensitivity: null,
    photosensitivityNotes: '',
    scarKeloidTendency: null,
    isotretinoinHistory: null,
    isotretinoinNotes: '',
    pregnancyLactation: null,
    priorReactions: '',
    contraindications: '',
  },
};

const MANDATORY_LABELS = {
  chiefComplaint: 'Chief complaint',
  durationValue: 'Duration',
  durationUnit: 'Duration unit',
  bodyArea: 'Body area',
  allergiesReviewed: 'Allergies (confirm)',
  currentMedicationsReviewed: 'Current medicines (confirm)',
  conditionsReviewed: 'Conditions (confirm)',
  pastTreatmentReviewed: 'Relevant past treatment (confirm)',
};

/**
 * §2 Pre-consult intake screen — nurse-facing. Fields, autosave-debounce+saved/error indicator
 * pattern and mandatory-incomplete guard are lifted directly from SoapEditor.jsx/VitalsForm.jsx so
 * the intake screen doesn't invent a second UX for the same "confirm clinical data" job.
 */
export function IntakeForm({ consultationId, readOnly }) {
  const { t } = useTranslation();
  const { data, isLoading } = useIntake(consultationId);
  const { save } = useIntakeAutosave(consultationId, { enabled: !readOnly });
  const [form, setForm] = useState(EMPTY_FORM);
  const [draftStatus, setDraftStatus] = useState('idle');

  // Hydrate once per consultation — re-hydrating on every refetch would wipe unsaved nurse edits.
  const hydratedFor = useRef(null);
  useEffect(() => {
    if (!data || hydratedFor.current === consultationId) return;
    hydratedFor.current = consultationId;
    const intake = data.intake;
    const medical = data.patientMedical;
    setForm({
      category: intake?.category || 'GENERAL',
      chiefComplaint: intake?.chiefComplaint ?? '',
      durationValue: intake?.durationValue ?? '',
      durationUnit: intake?.durationUnit ?? '',
      bodyArea: intake?.bodyArea ?? '',
      // Never force re-entry of already-known data: pre-fill from the patient's medical record
      // when the intake row has nothing of its own yet, but leave the *Reviewed flags false so
      // the nurse still explicitly confirms them for this visit.
      allergies:
        intake?.allergies ??
        (medical?.noKnownDrugAllergies ? 'No known drug allergies' : medical?.allergies || ''),
      allergiesReviewed: intake?.allergiesReviewed ?? false,
      currentMedications: intake?.currentMedications ?? medical?.currentMedications ?? '',
      currentMedicationsReviewed: intake?.currentMedicationsReviewed ?? false,
      conditions:
        intake?.conditions ??
        [medical?.chronicDiseases, medical?.pastMedicalHistory].filter(Boolean).join(' | ') ??
        '',
      conditionsReviewed: intake?.conditionsReviewed ?? false,
      pastTreatment: intake?.pastTreatment ?? medical?.pastSurgicalHistory ?? '',
      pastTreatmentReviewed: intake?.pastTreatmentReviewed ?? false,
      skinHistory: {
        skinType: intake?.skinHistory?.skinType || '',
        photosensitivity: intake?.skinHistory?.photosensitivity ?? null,
        photosensitivityNotes: intake?.skinHistory?.photosensitivityNotes || '',
        scarKeloidTendency: intake?.skinHistory?.scarKeloidTendency ?? null,
        isotretinoinHistory: intake?.skinHistory?.isotretinoinHistory ?? null,
        isotretinoinNotes: intake?.skinHistory?.isotretinoinNotes || '',
        pregnancyLactation: intake?.skinHistory?.pregnancyLactation ?? null,
        priorReactions: intake?.skinHistory?.priorReactions || '',
        contraindications: intake?.skinHistory?.contraindications || '',
      },
    });
  }, [data, consultationId]);

  const commit = (next) => {
    setForm(next);
    if (!readOnly) {
      save(
        {
          ...next,
          durationValue: next.durationValue === '' ? null : Number(next.durationValue),
          durationUnit: next.durationUnit || null,
        },
        setDraftStatus
      );
    }
  };

  const onField = (key) => (e) => commit({ ...form, [key]: e.target.value });
  const onCheck = (key) => (e) => commit({ ...form, [key]: e.target.checked });
  const onSkin = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    commit({ ...form, skinHistory: { ...form.skinHistory, [key]: value } });
  };
  const onSkinTri = (key) => (value) =>
    commit({ ...form, skinHistory: { ...form.skinHistory, [key]: value } });

  const mandatoryIncomplete = data?.intake?.mandatoryIncomplete ?? [];
  const isComplete = data?.intake?.isComplete ?? false;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('consultations.intake.title', 'Pre-consult intake')}</h3>
        {!readOnly && <DraftIndicator status={draftStatus} />}
      </div>

      {/* ⚠ Guard — mandatory items flagged incomplete, visible before the doctor opens the encounter. */}
      {!isComplete && mandatoryIncomplete.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
            {t('consultations.intake.incompleteTitle', 'Incomplete — required before the encounter')}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {mandatoryIncomplete.map((key) => (
              <li
                key={key}
                className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive"
              >
                {t(`consultations.intake.mandatory.${key}`, MANDATORY_LABELS[key] || key)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {isComplete && (
        <p className="text-xs font-medium text-emerald-700">
          {t('consultations.intake.complete', 'Intake complete')}
        </p>
      )}

      <div className="space-y-1.5">
        <Label>{t('consultations.intake.category', 'Specialty template')}</Label>
        <Select value={form.category} onChange={onField('category')} disabled={readOnly}>
          {INTAKE_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('consultations.intake.presentSection', 'Presenting complaint')}
        </p>
        <div className="space-y-1.5">
          <Label className={mandatoryIncomplete.includes('chiefComplaint') ? 'text-destructive' : ''}>
            {t('consultations.intake.chiefComplaint', 'Chief complaint')} *
          </Label>
          <textarea
            className="min-h-[70px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            value={form.chiefComplaint}
            onChange={onField('chiefComplaint')}
            disabled={readOnly}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className={mandatoryIncomplete.includes('durationValue') ? 'text-destructive' : ''}>
              {t('consultations.intake.duration', 'Duration')} *
            </Label>
            <Input
              type="number"
              min="0"
              value={form.durationValue}
              onChange={onField('durationValue')}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={mandatoryIncomplete.includes('durationUnit') ? 'text-destructive' : ''}>
              {t('consultations.intake.durationUnit', 'Unit')} *
            </Label>
            <Select value={form.durationUnit} onChange={onField('durationUnit')} disabled={readOnly}>
              <option value="">{t('common.select', 'Select…')}</option>
              {DURATION_UNIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className={mandatoryIncomplete.includes('bodyArea') ? 'text-destructive' : ''}>
              {t('consultations.intake.bodyArea', 'Body area')} *
            </Label>
            <Input value={form.bodyArea} onChange={onField('bodyArea')} disabled={readOnly} />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('consultations.intake.historySection', 'Confirm known history')}
        </p>
        {[
          { key: 'allergies', reviewKey: 'allergiesReviewed', label: 'Allergies' },
          { key: 'currentMedications', reviewKey: 'currentMedicationsReviewed', label: 'Current medicines' },
          { key: 'conditions', reviewKey: 'conditionsReviewed', label: 'Conditions' },
          { key: 'pastTreatment', reviewKey: 'pastTreatmentReviewed', label: 'Relevant past treatment' },
        ].map(({ key, reviewKey, label }) => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className={mandatoryIncomplete.includes(reviewKey) ? 'text-destructive' : ''}>
                {t(`consultations.intake.${key}`, label)} *
              </Label>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={Boolean(form[reviewKey])}
                  onChange={onCheck(reviewKey)}
                  disabled={readOnly}
                />
                {t('consultations.intake.confirmed', 'Confirmed for this visit')}
              </label>
            </div>
            <textarea
              className="min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={form[key]}
              onChange={onField(key)}
              disabled={readOnly}
              placeholder={t('consultations.intake.prefillHint', 'Pre-filled from patient record — edit if needed')}
            />
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('consultations.intake.skinHistorySection', 'Skin/hair/laser history (configurable)')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('consultations.intake.skinType', 'Skin type')}</Label>
            <Select value={form.skinHistory.skinType} onChange={onSkin('skinType')} disabled={readOnly}>
              <option value="">{t('common.select', 'Select…')}</option>
              {SKIN_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <TriStateField
            label={t('consultations.intake.photosensitivity', 'Photosensitivity / tanning')}
            value={form.skinHistory.photosensitivity}
            onChange={onSkinTri('photosensitivity')}
            disabled={readOnly}
          />
          <TriStateField
            label={t('consultations.intake.scarKeloid', 'Scar/keloid tendency')}
            value={form.skinHistory.scarKeloidTendency}
            onChange={onSkinTri('scarKeloidTendency')}
            disabled={readOnly}
          />
          <TriStateField
            label={t('consultations.intake.isotretinoin', 'Isotretinoin history')}
            value={form.skinHistory.isotretinoinHistory}
            onChange={onSkinTri('isotretinoinHistory')}
            disabled={readOnly}
          />
          <TriStateField
            label={t('consultations.intake.pregnancyLactation', 'Pregnancy / lactation (if relevant)')}
            value={form.skinHistory.pregnancyLactation}
            onChange={onSkinTri('pregnancyLactation')}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('consultations.intake.priorReactions', 'Prior reactions')}</Label>
          <textarea
            className="min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            value={form.skinHistory.priorReactions}
            onChange={onSkin('priorReactions')}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('consultations.intake.contraindications', 'Device/medicine contraindications')}</Label>
          <textarea
            className="min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            value={form.skinHistory.contraindications}
            onChange={onSkin('contraindications')}
            disabled={readOnly}
          />
        </div>
      </div>
    </div>
  );
}

function TriStateField({ label, value, onChange, disabled }) {
  const { t } = useTranslation();
  const strValue = value === true ? 'true' : value === false ? 'false' : '';
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={strValue}
        onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')}
        disabled={disabled}
      >
        <option value="">{t('common.unknown', 'Unknown')}</option>
        <option value="true">{t('common.yes', 'Yes')}</option>
        <option value="false">{t('common.no', 'No')}</option>
      </Select>
    </div>
  );
}

export default IntakeForm;
