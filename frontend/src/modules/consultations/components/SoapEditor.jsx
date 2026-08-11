import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { DraftIndicator } from './StatusBadges';
import { useSoapAutosave, useSoapVersions } from '../hooks/useConsultations';
import { useInsertTarget } from '../hooks/useInsertTarget';
import { INSERT_TARGETS, appendText } from '../insertBus';

export function SoapEditor({ consultationId, soap, readOnly }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });
  const [draftStatus, setDraftStatus] = useState('idle');
  const { save } = useSoapAutosave(consultationId, { enabled: !readOnly });
  const { data: versions } = useSoapVersions(consultationId);

  /**
   * Hydrate from the server ONCE per consultation. Re-running on every new `soap` object identity
   * would wipe unsaved edits — including AI text the doctor just accepted — whenever the workspace
   * query refetches (and on every React StrictMode effect replay).
   */
  const hydratedFor = useRef(null);
  useEffect(() => {
    if (hydratedFor.current === consultationId) return;
    hydratedFor.current = consultationId;
    setForm({
      subjective: soap?.subjective || '',
      objective: soap?.objective || '',
      assessment: soap?.assessment || '',
      plan: soap?.plan || '',
    });
  }, [soap, consultationId]);

  const onChange = (field) => (e) => {
    const next = { ...form, [field]: e.target.value };
    setForm(next);
    if (!readOnly) save(next, setDraftStatus);
  };

  /**
   * AI-accepted text lands here as an ordinary edit: appended to the field, still fully editable,
   * autosaved as a DRAFT only. Signing remains a separate, explicit clinician action.
   */
  const appendInto = (field) => ({ text }) => {
    setForm((prev) => {
      const next = { ...prev, [field]: appendText(prev[field], text) };
      save(next, setDraftStatus);
      return next;
    });
  };

  useInsertTarget(INSERT_TARGETS.SOAP_SUBJECTIVE, appendInto('subjective'), !readOnly);
  useInsertTarget(INSERT_TARGETS.SOAP_OBJECTIVE, appendInto('objective'), !readOnly);
  useInsertTarget(INSERT_TARGETS.SOAP_ASSESSMENT, appendInto('assessment'), !readOnly);
  useInsertTarget(INSERT_TARGETS.SOAP_PLAN, appendInto('plan'), !readOnly);

  // Tap-to-add common phrases so the doctor types as little as possible.
  const fields = [
    {
      key: 'subjective',
      label: t('consultations.soap.subjective', "Today's note / complaint"),
      chips: ['Itching present', 'Burning sensation', 'Worse in sun', 'No pain', 'No fever', 'Since months', 'Recurring'],
    },
    {
      key: 'objective',
      label: t('consultations.soap.objective', 'Examination'),
      chips: ['Erythematous patches', 'Scaling present', 'Hyperpigmentation', 'Well-demarcated lesion', 'Acne lesions', 'Hair thinning', 'No secondary infection'],
    },
    {
      key: 'assessment',
      label: t('consultations.soap.assessment', 'Assessment / diagnosis'),
      chips: [],
    },
    {
      key: 'plan',
      label: t('consultations.soap.plan', 'Plan / advice'),
      chips: ['Topical treatment started', 'Oral medication started', 'Advised sun protection', 'Review after 2 weeks', 'Review after 1 month', 'Investigations advised', 'Photo-documentation done'],
    },
  ];

  const addChip = (key, phrase) => {
    setForm((prev) => {
      const next = { ...prev, [key]: appendText(prev[key], phrase) };
      if (!readOnly) save(next, setDraftStatus);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('consultations.soap.title', 'Consultation notes')}</h3>
        {!readOnly && <DraftIndicator status={draftStatus} />}
      </div>
      {fields.map(({ key, label, chips }) => (
        <div key={key} className="space-y-1">
          <Label>{label}</Label>
          {!readOnly && chips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => addChip(key, c)}
                  className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs hover:bg-accent"
                >
                  + {c}
                </button>
              ))}
            </div>
          )}
          <textarea
            className="min-h-[64px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            value={form[key]}
            onChange={onChange(key)}
            disabled={readOnly}
            placeholder={`${label}…`}
          />
        </div>
      ))}
      {versions?.versions?.length > 0 && (
        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('consultations.soap.versionHistory', 'Version history (v{{version}})', {
              version: versions.currentVersion,
            })}
          </p>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {[...versions.versions].reverse().slice(0, 8).map((v) => (
              <li key={v.version}>
                v{v.version} · {v.savedAt ? new Date(v.savedAt).toLocaleString() : '—'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
