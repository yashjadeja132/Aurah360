import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { CONTENT_CLASSIFICATION_OPTIONS } from '../constants';
import { useReleaseSummary } from '../hooks/useConsultations';

/**
 * §3.7 — "Note → classify comments: Staff-only / Internal clinical / Patient-facing → Release
 * summary". One row per note section (SOAP + diagnosis + follow-up instructions), each with its
 * own 3-way classifier; only rows left as Patient-facing get sent to the patient app. Existing
 * signed consultations that never went through this classifier show up as Internal clinical by
 * default (the backend's default too) — nothing is exposed to a patient without an explicit,
 * current choice.
 */
export function ReleaseSummaryPanel({ consultationId, soap, diagnosis, followUp, consultation }) {
  const { t } = useTranslation();
  const release = useReleaseSummary(consultationId);

  const canRelease = ['SIGNED', 'LOCKED'].includes(consultation?.status);

  const buildDefaultSections = () => {
    const existing = consultation?.releaseSections || [];
    const byKey = Object.fromEntries(existing.map((s) => [s.key, s]));
    const candidates = [
      { key: 'subjective', label: t('consultations.soap.subjective', 'Subjective'), text: soap?.subjective },
      { key: 'objective', label: t('consultations.soap.objective', 'Objective'), text: soap?.objective },
      { key: 'assessment', label: t('consultations.soap.assessment', 'Assessment'), text: soap?.assessment },
      { key: 'plan', label: t('consultations.soap.plan', 'Plan'), text: soap?.plan },
      {
        key: 'diagnosis',
        label: t('consultations.diagnosis.title', 'Diagnosis'),
        text: diagnosis?.primaryDiagnosis,
      },
      {
        key: 'followUpInstructions',
        label: t('consultations.followUp.instructions', 'Follow-up instructions'),
        text: followUp?.instructions,
      },
    ];
    return candidates
      .filter((c) => (c.text || '').trim() || byKey[c.key])
      .map((c) => ({
        key: c.key,
        label: c.label,
        text: byKey[c.key]?.text ?? c.text ?? '',
        classification: byKey[c.key]?.classification || 'INTERNAL_CLINICAL',
      }));
  };

  const [rows, setRows] = useState(buildDefaultSections);

  // Re-hydrate when the underlying note content changes materially (new consultation, or a
  // section that had no text before now has some) — but never clobber a classification the
  // doctor already picked in this sitting.
  useEffect(() => {
    setRows((prev) => {
      const prevByKey = Object.fromEntries(prev.map((r) => [r.key, r]));
      return buildDefaultSections().map((r) => ({
        ...r,
        classification: prevByKey[r.key]?.classification || r.classification,
        text: prevByKey[r.key] ? prevByKey[r.key].text : r.text,
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultationId, soap?.subjective, soap?.objective, soap?.assessment, soap?.plan, diagnosis?.primaryDiagnosis, followUp?.instructions]);

  const setClassification = (key, classification) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, classification } : r)));

  const patientFacingCount = rows.filter((r) => r.classification === 'PATIENT_FACING').length;

  const submit = () => {
    release.mutate({ sections: rows.map(({ key, label, text, classification }) => ({ key, label, text, classification })) });
  };

  if (!canRelease) {
    return (
      <div className="space-y-2">
        <h3 className="font-semibold">{t('consultations.release.title', 'Release to patient')}</h3>
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t(
            'consultations.release.needsSignature',
            'Sign the consultation first — only a signed or locked note can be released to the patient app.'
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{t('consultations.release.title', 'Release to patient')}</h3>
        <p className="text-xs text-muted-foreground">
          {t(
            'consultations.release.hint',
            'Classify each section before releasing. Only sections marked Patient-facing ever become visible in the patient app — Staff-only and Internal clinical always stay internal.'
          )}
        </p>
      </div>

      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t('consultations.release.empty', 'Nothing to classify yet — write the note first.')}
        </p>
      )}

      {rows.map((row) => (
        <div key={row.key} className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="font-medium">{row.label}</Label>
            <Select
              className="w-48"
              value={row.classification}
              onChange={(e) => setClassification(row.key, e.target.value)}
            >
              {CONTENT_CLASSIFICATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`consultations.release.classification.${opt.value}`, opt.label)}
                </option>
              ))}
            </Select>
          </div>
          <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{row.text || '—'}</p>
        </div>
      ))}

      {consultation?.patientFacingReleasedAt && (
        <p className="text-xs text-muted-foreground">
          {t('consultations.release.lastReleased', 'Last released')}:{' '}
          {new Date(consultation.patientFacingReleasedAt).toLocaleString()}
        </p>
      )}

      <PermissionGuard permissions={[PERMISSIONS.CONSULTATION_SIGN, PERMISSIONS.CONSULTATION_ALL]}>
        <div className="flex items-center gap-3">
          <Button disabled={release.isPending || rows.length === 0} onClick={submit}>
            <Send className="h-4 w-4" />
            {t('consultations.release.submit', 'Release summary')}
          </Button>
          <Badge variant={patientFacingCount ? 'success' : 'secondary'}>
            {t('consultations.release.patientFacingCount', '{{count}} patient-facing', {
              count: patientFacingCount,
            })}
          </Badge>
        </div>
      </PermissionGuard>
    </div>
  );
}

export default ReleaseSummaryPanel;
