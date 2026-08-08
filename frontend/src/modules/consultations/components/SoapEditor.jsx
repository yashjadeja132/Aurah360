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

  const fields = [
    { key: 'subjective', label: t('consultations.soap.subjective', 'Subjective') },
    { key: 'objective', label: t('consultations.soap.objective', 'Objective') },
    { key: 'assessment', label: t('consultations.soap.assessment', 'Assessment') },
    { key: 'plan', label: t('consultations.soap.plan', 'Plan') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('consultations.soap.title', 'SOAP Notes')}</h3>
        {!readOnly && <DraftIndicator status={draftStatus} />}
      </div>
      {fields.map(({ key, label }) => (
        <div key={key} className="space-y-1.5">
          <Label>{label}</Label>
          <textarea
            className="min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
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
