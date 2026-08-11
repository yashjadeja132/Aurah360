import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { ConflictBanner, DraftIndicator } from './StatusBadges';
import { DiagnosisForm } from './DiagnosisExamForms';
import { useSoapAutosave, useSoapVersions } from '../hooks/useConsultations';
import { useInsertTarget } from '../hooks/useInsertTarget';
import { INSERT_TARGETS, appendText } from '../insertBus';
import { consultationsApi } from '../api/consultationsApi';

/**
 * §3 workspace diagram + §3.1: "Assessment / diagnosis" is one section of the note, not a separate
 * clinical record. `DiagnosisForm` is mounted directly under the Assessment textarea so the doctor
 * writes the free-text assessment and confirms the structured diagnosis in one place. `DiagnosisForm`
 * keeps its own save call (useSaveDiagnosis) — this is a UI relocation only, the diagnosis data
 * model and API are untouched.
 *
 * NOTE — favorites/quick-pick chips for Diagnosis/Examination (spec gap, tracked separately): there
 * is currently no "Diagnosis / medicine favorites & dictionaries" master-data category in
 * backend/src/constants/masterTypes.js, so DiagnosisForm/ExaminationForm below stay plain free-text
 * rather than being wired to a fabricated/hardcoded favorites list. Once that master category
 * exists, wire it the same way MedicineSearchInput.jsx sources its catalog.
 */
export function SoapEditor({ consultationId, soap, diagnosis, readOnly, doctorId, patientId }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });
  const [draftStatus, setDraftStatus] = useState('idle');
  const { save, setKnownVersion } = useSoapAutosave(consultationId, { enabled: !readOnly });
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
    // Fix 3 — seed the optimistic-concurrency token from whatever version the workspace load
    // actually returned, so the very first autosave from this mount already carries a real
    // baseVersion instead of skipping the check.
    setKnownVersion(soap?.currentVersion ?? null);
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

  // ---------------------------------------------------------------------------------------------
  // Fix 1a — template picker. Doctor's own + shared SOAP templates; picking one fills the SAME
  // editable fields the doctor already types into (no separate read-only preview).
  // ---------------------------------------------------------------------------------------------
  const templatesQuery = useQuery({
    queryKey: ['consultations', 'templates', doctorId, 'SOAP'],
    queryFn: async () => {
      const res = await consultationsApi.listTemplates({ doctorId, templateType: 'SOAP' });
      return res.data || [];
    },
    enabled: Boolean(doctorId) && !readOnly,
  });
  const templates = templatesQuery.data || [];

  const applyTemplate = (templateId) => {
    const template = templates.find((tpl) => tpl.id === templateId);
    if (!template) return;
    const content = template.content || {};
    setForm((prev) => {
      const next = {
        subjective: content.subjective ?? prev.subjective,
        objective: content.objective ?? prev.objective,
        assessment: content.assessment ?? prev.assessment,
        plan: content.plan ?? prev.plan,
      };
      save(next, setDraftStatus);
      return next;
    });
  };

  // ---------------------------------------------------------------------------------------------
  // Fix 1b — "Copy previous" consultation. Two explicit steps: (1) find + fetch the patient's most
  // recent SIGNED/LOCKED consultation's SOAP and stage it, (2) doctor reviews the source date and
  // explicitly confirms before it lands in the editable fields. Never silently overwrites/autosaves.
  // ---------------------------------------------------------------------------------------------
  const [copyPending, setCopyPending] = useState(false);
  const [copyPreview, setCopyPreview] = useState(null); // { sourceDate, soap }
  const [copyError, setCopyError] = useState(null);

  const findPreviousSoap = async () => {
    if (!patientId) return;
    setCopyPending(true);
    setCopyError(null);
    try {
      const listRes = await consultationsApi.listByPatient(patientId);
      const rows = (listRes.data || [])
        .filter((c) => c.id !== consultationId && (c.status === 'SIGNED' || c.status === 'LOCKED'))
        .sort((a, b) => new Date(b.startedAt || b.createdAt) - new Date(a.startedAt || a.createdAt));
      const previous = rows[0];
      if (!previous) {
        setCopyError(
          t('consultations.soap.copyPreviousNone', 'No prior signed consultation found for this patient.')
        );
        return;
      }
      const workspaceRes = await consultationsApi.getWorkspace(previous.id);
      setCopyPreview({
        sourceDate: previous.startedAt || previous.createdAt,
        soap: workspaceRes.data?.soap || null,
      });
    } catch {
      setCopyError(t('consultations.soap.copyPreviousFailed', 'Could not load the previous consultation.'));
    } finally {
      setCopyPending(false);
    }
  };

  const confirmCopyPrevious = () => {
    if (!copyPreview?.soap) return;
    const src = copyPreview.soap;
    setForm((prev) => {
      const next = {
        subjective: src.subjective ?? prev.subjective,
        objective: src.objective ?? prev.objective,
        assessment: src.assessment ?? prev.assessment,
        plan: src.plan ?? prev.plan,
      };
      save(next, setDraftStatus);
      return next;
    });
    setCopyPreview(null);
  };

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
        {!readOnly && draftStatus !== 'conflict' && <DraftIndicator status={draftStatus} />}
      </div>

      {draftStatus === 'conflict' && (
        <ConflictBanner onReload={() => window.location.reload()} />
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <Select
            className="w-auto min-w-[10rem]"
            value=""
            onChange={(e) => {
              if (e.target.value) applyTemplate(e.target.value);
              e.target.value = '';
            }}
            disabled={!templates.length}
          >
            <option value="">
              {templatesQuery.isLoading
                ? t('consultations.soap.templatesLoading', 'Loading templates…')
                : templates.length
                  ? t('consultations.soap.templatePick', 'Use a template…')
                  : t('consultations.soap.templatesNone', 'No templates available')}
            </option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={copyPending || !patientId}
            onClick={findPreviousSoap}
          >
            {copyPending
              ? t('consultations.soap.copyPreviousLoading', 'Loading…')
              : t('consultations.soap.copyPrevious', 'Copy previous')}
          </Button>
          {copyError && <span className="text-xs text-destructive">{copyError}</span>}
        </div>
      )}

      {copyPreview && (
        <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
          <p className="text-sm font-medium">
            {t(
              'consultations.soap.copyPreviousBanner',
              'Reviewing note from {{date}} — edit as needed before it is applied.',
              {
                date: copyPreview.sourceDate ? new Date(copyPreview.sourceDate).toLocaleString() : '—',
              }
            )}
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={confirmCopyPrevious}>
              {t('consultations.soap.copyPreviousApply', 'Apply to note')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCopyPreview(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      )}

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
          {key === 'assessment' && (
            <div className="mt-2 rounded-lg border bg-muted/30 p-3">
              <DiagnosisForm consultationId={consultationId} diagnosis={diagnosis} readOnly={readOnly} />
            </div>
          )}
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
