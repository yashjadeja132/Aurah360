import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy, Pill, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { APP_ROUTES } from '@/constants/routes';
import { INSERT_TARGETS } from '../insertBus';
import { useInsertTarget } from '../hooks/useInsertTarget';
import { MedicineSearchInput } from '@/modules/prescriptions/components/MedicineSearchInput';

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
 * Scratchpad for prescription lines the doctor accepted from the copilot. It is deliberately a
 * DRAFT and nothing else: it never posts a prescription, so an AI suggestion can never become a
 * dispensable Rx without the doctor re-entering it in the prescription module and signing there.
 */
export function PrescriptionDraftPanel({ consultationId, readOnly }) {
  const { t } = useTranslation();
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

      {!readOnly && (
        <div className="space-y-1">
          <Label className="text-xs">
            {t('consultations.rxDraft.search', 'Type a keyword — matching medicines appear')}
          </Label>
          <MedicineSearchInput
            placeholder={t('consultations.rxDraft.searchPlaceholder', 'e.g. clotrimazole, minoxidil…')}
            onSelect={(m) =>
              setLines((prev) => [
                ...prev,
                {
                  ...EMPTY_LINE,
                  genericName: m.genericName || m.name || '',
                  brand: m.brand || m.name || '',
                  composition: m.genericName || '',
                  formStrength: m.strength || '',
                },
              ])
            }
          />
        </div>
      )}

      {lines.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t('consultations.rxDraft.empty', 'No draft lines yet.')}
        </p>
      )}

      {/* Compact: medicine + dosing + duration on one row; details tuck into a
          collapsible so the panel stays small. */}
      {lines.map((line, index) => (
        <div key={index} className="rounded-lg border p-2.5">
          <div className="flex items-center gap-2">
            <Input
              className="flex-1 font-medium"
              placeholder={t('consultations.rxDraft.generic', 'Medicine')}
              value={line.genericName}
              disabled={readOnly}
              onChange={patch(index, 'genericName')}
            />
            {!readOnly && (
              <Button size="sm" variant="ghost" className="shrink-0 px-2" onClick={() => remove(index)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <Input
              placeholder={t('consultations.rxDraft.dosing', 'Dosing (e.g. BD, apply twice)')}
              value={line.dosing}
              disabled={readOnly}
              onChange={patch(index, 'dosing')}
            />
            <Input
              placeholder={t('consultations.rxDraft.duration', 'Duration (e.g. 2 weeks)')}
              value={line.duration}
              disabled={readOnly}
              onChange={patch(index, 'duration')}
            />
          </div>
          {!readOnly && (
            <details className="mt-1">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {t('consultations.rxDraft.more', 'More (strength, brand, cautions)')}
              </summary>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                <Input placeholder={t('consultations.rxDraft.formStrength', 'Form / strength')} value={line.formStrength} onChange={patch(index, 'formStrength')} />
                <Input placeholder={t('consultations.rxDraft.brand', 'Brand example')} value={line.brand} onChange={patch(index, 'brand')} />
              </div>
              {line.cautions ? (
                <p className="mt-1 text-xs text-warning">⚠ {line.cautions}</p>
              ) : null}
            </details>
          )}
          {readOnly && line.cautions ? <p className="mt-1 text-xs text-warning">⚠ {line.cautions}</p> : null}
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
