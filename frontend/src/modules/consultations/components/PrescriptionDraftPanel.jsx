import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy, FilePlus2, Pill, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { APP_ROUTES, prescriptionEditPath } from '@/constants/routes';
import { useCreatePrescription } from '@/modules/prescriptions/hooks/usePrescriptions';
import { INSERT_TARGETS } from '../insertBus';
import { useInsertTarget } from '../hooks/useInsertTarget';

const EMPTY_LINE = {
  genericName: '',
  brand: '',
  composition: '',
  formStrength: '',
  dosing: '',
  duration: '',
  cautions: '',
};

const storageKey = (consultationId) => `aurah360.consultation.${consultationId}.rxDraft`;

function readDraft(consultationId) {
  if (!consultationId || typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(storageKey(consultationId));
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Scratchpad for prescription lines the doctor accepted from the copilot. Lines start as a
 * sessionStorage-only DRAFT — nothing here is dispensable — and stay editable until the doctor
 * explicitly presses "Create prescription from draft" (Fix 5), which posts them as a real
 * consultation-linked Prescription (DRAFT status) and hands off to the real prescription editor.
 * That editor still runs the same PrescriptionSafetyPanel/finalize gate as any other prescription,
 * so an AI suggestion can never become a dispensable Rx without going through it.
 */
export function PrescriptionDraftPanel({ consultationId, readOnly }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createPrescription = useCreatePrescription();
  const [lines, setLines] = useState(() => readDraft(consultationId));

  useEffect(() => setLines(readDraft(consultationId)), [consultationId]);

  useEffect(() => {
    if (!consultationId || typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(storageKey(consultationId), JSON.stringify(lines));
    } catch {
      /* ignore quota errors — the draft simply stays in memory */
    }
  }, [lines, consultationId]);

  useInsertTarget(
    INSERT_TARGETS.PRESCRIPTION_LINE,
    (med) => {
      setLines((prev) => [
        ...prev,
        {
          ...EMPTY_LINE,
          genericName: med?.generic_name || '',
          brand: med?.indian_brand_example || '',
          composition: med?.composition || '',
          formStrength: med?.form_strength || '',
          dosing: med?.typical_dosing || '',
          duration: med?.typical_duration || '',
          cautions: med?.cautions || '',
        },
      ]);
    },
    !readOnly
  );

  const patch = (index, field) => (e) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: e.target.value } : l)));

  const remove = (index) => setLines((prev) => prev.filter((_, i) => i !== index));

  const copyAll = async () => {
    const text = lines
      .map(
        (l) =>
          `${l.genericName}${l.formStrength ? ` ${l.formStrength}` : ''}${l.brand ? ` (${l.brand})` : ''} — ${l.dosing}${
            l.duration ? ` × ${l.duration}` : ''
          }`
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('consultations.rxDraft.copied', 'Draft copied to clipboard'));
    } catch {
      toast.error(t('consultations.rxDraft.copyFailed', 'Could not copy — select the text manually.'));
    }
  };

  /**
   * Fix 5 — turns the sessionStorage-only scratchpad into a real, consultation-linked
   * Prescription. Goes through the SAME create mutation (and therefore the same
   * safety-check/finalize gate on PrescriptionEditorPage) that the prescription module's own
   * "New prescription" flow uses — this never bypasses PrescriptionSafetyPanel, it just lands the
   * doctor on the real editor with the drafted lines already filled in as an editable DRAFT.
   */
  const createRealPrescription = async () => {
    if (!lines.length) return;
    const items = lines.map((l) => ({
      medicineName: l.genericName?.trim() || l.brand?.trim() || t('consultations.rxDraft.untitled', 'Untitled medicine'),
      genericName: l.genericName || null,
      strength: l.formStrength || null,
      dosage: l.dosing || null,
      duration: l.duration || null,
      instructions: [l.composition, l.brand].filter(Boolean).join(' · ') || null,
      remarks: l.cautions || null,
    }));
    try {
      const res = await createPrescription.mutateAsync({ consultationId, items });
      const newId = res?.data?.prescription?.id;
      if (newId) {
        // The draft has become a real prescription — the sessionStorage scratchpad no longer
        // represents anything unsaved, so it's cleared rather than left to resurrect stale lines.
        try {
          window.sessionStorage.removeItem(storageKey(consultationId));
        } catch {
          /* ignore */
        }
        setLines([]);
        navigate(`${prescriptionEditPath(newId)}?consultationId=${consultationId}`);
      }
    } catch {
      /* useCreatePrescription already toasts the error */
    }
  };

  const FIELDS = [
    { key: 'genericName', label: t('consultations.rxDraft.generic', 'Generic name') },
    { key: 'formStrength', label: t('consultations.rxDraft.formStrength', 'Form / strength') },
    { key: 'composition', label: t('consultations.rxDraft.composition', 'Composition') },
    { key: 'brand', label: t('consultations.rxDraft.brand', 'Brand example') },
    { key: 'dosing', label: t('consultations.rxDraft.dosing', 'Dosing') },
    { key: 'duration', label: t('consultations.rxDraft.duration', 'Duration') },
  ];

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 font-semibold">
        <Pill className="h-4 w-4" />
        {t('consultations.rxDraft.title', 'Prescription draft')}
      </h3>
      <p className="text-xs text-muted-foreground">
        {t(
          'consultations.rxDraft.hint',
          'Unsigned working list. Accepting a medication suggestion adds a line here — edit it, then create the real prescription in the prescription module.'
        )}
      </p>

      {lines.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t('consultations.rxDraft.empty', 'No draft lines yet.')}
        </p>
      )}

      {lines.map((line, index) => (
        <div key={index} className="space-y-2 rounded-lg border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">{f.label}</Label>
                <Input value={line[f.key]} disabled={readOnly} onChange={patch(index, f.key)} />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-warning">{t('consultations.rxDraft.cautions', 'Cautions')}</Label>
            <textarea
              className="min-h-[52px] w-full rounded-lg border px-3 py-2 text-sm"
              value={line.cautions}
              disabled={readOnly}
              onChange={patch(index, 'cautions')}
            />
          </div>
          {!readOnly && (
            <Button size="sm" variant="ghost" onClick={() => remove(index)}>
              <Trash2 className="h-3.5 w-3.5" />
              {t('consultations.rxDraft.remove', 'Remove line')}
            </Button>
          )}
        </div>
      ))}

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}>
            <Plus className="h-3.5 w-3.5" />
            {t('consultations.rxDraft.addLine', 'Add blank line')}
          </Button>
          {lines.length > 0 && (
            <Button size="sm" variant="outline" onClick={copyAll}>
              <Copy className="h-3.5 w-3.5" />
              {t('consultations.rxDraft.copy', 'Copy draft')}
            </Button>
          )}
          <PermissionGuard permissions={[PERMISSIONS.PRESCRIPTION_CREATE, PERMISSIONS.PRESCRIPTION_ALL]}>
            <Button
              size="sm"
              disabled={lines.length === 0 || createPrescription.isPending}
              onClick={createRealPrescription}
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              {t('consultations.rxDraft.createPrescription', 'Create prescription from draft')}
            </Button>
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL]}>
            <Button asChild size="sm" variant="outline">
              <Link to={`${APP_ROUTES.PRESCRIPTIONS}?consultationId=${consultationId}`}>
                {t('consultations.rxDraft.openModule', 'Open prescription module')}
              </Link>
            </Button>
          </PermissionGuard>
        </div>
      )}
    </div>
  );
}

export default PrescriptionDraftPanel;
