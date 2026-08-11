import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, Plus, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { SearchableCombobox } from '@/components/common/SearchableCombobox';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import {
  useSession,
  useCheckInSession,
  useStartSession,
  usePauseSession,
  useResumeSession,
  useCompleteSession,
  useCancelSession,
  useSkipSession,
  useRescheduleSession,
  useUploadSessionPhoto,
} from '@/modules/treatmentSessions/hooks/useTreatmentSessions';
import { useInventoryItems } from '@/modules/inventory/hooks/useInventory';
import { useProtocols } from '@/modules/treatmentPlans/hooks/useTreatmentPlans';
import { SessionPreflightPanel } from '@/modules/treatmentSessions/components/SessionPreflightPanel';
import { SESSION_STATUS_LABELS } from '@/modules/treatmentSessions/constants';
import { APP_ROUTES, treatmentSessionPrintPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { APP_CONFIG } from '@/constants/config';

/** Empty typed-settings row used both for the "current settings" panel and each consumable line. */
const EMPTY_SETTINGS = {
  wavelength: '',
  fluence: '',
  pulseWidth: '',
  spotSize: '',
  coolingSetting: '',
  passes: '',
};

export default function SessionExecutionPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: session, isLoading, isError, error } = useSession(id);
  const checkIn = useCheckInSession(id);
  const start = useStartSession(id);
  const pause = usePauseSession(id);
  const resume = useResumeSession(id);
  const complete = useCompleteSession(id);
  const cancel = useCancelSession(id);
  const skip = useSkipSession(id);
  const reschedule = useRescheduleSession(id);
  const upload = useUploadSessionPhoto(id);

  // Consumables picker draws from the CONSUMABLE inventory slice — same source pharmacy dispense
  // uses for MEDICINE, just filtered to the other item type.
  const { data: invData } = useInventoryItems({ itemType: 'CONSUMABLE', limit: 100 });
  const invItems = invData?.items || [];

  // Aftercare template picker draws from the session's own protocol items — each protocol item
  // already carries `postInstructions` (the protocol-defined aftercare text), so this references
  // "which item's aftercare was given" instead of duplicating that text into a parallel field.
  const { data: protocolsData } = useProtocols({ limit: 100 });
  const sessionProtocol = (protocolsData?.items || protocolsData || []).find(
    (p) => p.id === session?.protocolId
  );
  const aftercareOptions = sessionProtocol?.items || [];

  const [outcome, setOutcome] = useState('');
  const [device, setDevice] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');

  // Spec 4 — outcome-form fields: how the session diverged from plan, which protocol-defined
  // aftercare was given (+ any deviation notes), and a pain score/observation (0-10, matching
  // ConsultationVitals.painScale).
  const [variationFromPlan, setVariationFromPlan] = useState('');
  const [aftercareTemplateId, setAftercareTemplateId] = useState('');
  const [aftercareNotes, setAftercareNotes] = useState('');
  const [painScore, setPainScore] = useState('');

  const [showPauseDialog, setShowPauseDialog] = useState(false);
  const [pauseReason, setPauseReason] = useState('');

  // Typed device-parameter fields (protocol-driven — all optional, mirrors deviceSettingsSchema).
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const [customParams, setCustomParams] = useState([]); // [{key, value}]

  // Consumables at complete time: batch-linked lines (preferred) plus a legacy free-text fallback
  // for anything not tracked in inventory. Both are additive — see SessionCompletePayload below.
  const [consumableLines, setConsumableLines] = useState([]);
  const [freeTextConsumables, setFreeTextConsumables] = useState('');

  if (isLoading)
    return (
      <p className="p-6 text-sm text-muted-foreground">{t('treatmentSessions.execution.loading', 'Loading…')}</p>
    );
  if (isError || !session) {
    return (
      <p className="p-6 text-sm text-destructive">
        {error?.response?.data?.message || t('treatmentSessions.execution.notFound', 'Session not found')}
      </p>
    );
  }

  const progress = session.progress || {};
  const pct = progress.completionPercent || 0;

  const buildDeviceUsage = () => {
    const customParameters = customParams.reduce((acc, { key, value }) => {
      if (key.trim()) acc[key.trim()] = value;
      return acc;
    }, {});
    return {
      device: device || session.deviceUsage?.device,
      machine: session.deviceUsage?.machine,
      laserHead: session.deviceUsage?.laserHead,
      settings: {
        wavelength: settings.wavelength === '' ? null : Number(settings.wavelength),
        fluence: settings.fluence === '' ? null : Number(settings.fluence),
        pulseWidth: settings.pulseWidth === '' ? null : Number(settings.pulseWidth),
        spotSize: settings.spotSize === '' ? null : Number(settings.spotSize),
        coolingSetting: settings.coolingSetting || null,
        passes: settings.passes === '' ? null : Number(settings.passes),
        customParameters,
      },
    };
  };

  const buildConsumablesUsed = () =>
    consumableLines
      .filter((l) => l.inventoryItemId && Number(l.quantity) > 0)
      .map((l) => {
        const item = invItems.find((i) => i.id === l.inventoryItemId);
        return {
          inventoryItemId: l.inventoryItemId,
          batchNumber: l.batchNumber || undefined,
          quantity: Number(l.quantity),
          productName: item?.name,
        };
      });

  const addConsumableLine = () =>
    setConsumableLines((lines) => [...lines, { inventoryItemId: '', batchNumber: '', quantity: 1 }]);

  const updateConsumableLine = (idx, patch) =>
    setConsumableLines((lines) => lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const removeConsumableLine = (idx) =>
    setConsumableLines((lines) => lines.filter((_, i) => i !== idx));

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to={APP_ROUTES.TREATMENT_SESSIONS}>
              <ArrowLeft className="h-4 w-4" />
              {t('treatmentSessions.execution.back', 'Back')}
            </Link>
          </Button>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-primary">
              {session.sessionNumber}
            </h1>
            <Badge>{SESSION_STATUS_LABELS[session.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {session.patient?.fullName} · {t('treatmentSessions.execution.doctorPrefix', 'Dr.')}{' '}
            {session.doctor?.name || '—'} · {t('treatmentSessions.execution.techPrefix', 'Tech')}{' '}
            {session.technician?.fullName || '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Adverse event reporting must be reachable from the session at all times — never
              gated behind billing/completion state (spec §5). Deep-links into the Treatments
              hub Safety tab, pre-filtered to this patient. */}
          <PermissionGuard permissions={[PERMISSIONS.ADVERSE_EVENT_CREATE]}>
            <Button asChild variant="destructive">
              <Link to={`${APP_ROUTES.TREATMENT_DASHBOARD}?tab=safety&patientId=${session.patientId}`}>
                <AlertTriangle className="h-4 w-4" />
                {t('treatmentSessions.execution.recordAdverseEvent', 'Record adverse event')}
              </Link>
            </Button>
          </PermissionGuard>
          <Button asChild variant="outline">
            <Link to={treatmentSessionPrintPath(id)}>
              <Printer className="h-4 w-4" />
              {t('treatmentSessions.execution.print', 'Print')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Large progress bar */}
      <div className="rounded-xl border p-4">
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium">{t('treatmentSessions.execution.planProgress', 'Plan progress')}</span>
          <span>
            {progress.completedSessions ?? 0}/{progress.totalSessions ?? '—'} · {pct}%
          </span>
        </div>
        <div className="h-4 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t('treatmentSessions.execution.remaining', 'Remaining')} {progress.remainingSessions ?? '—'} ·{' '}
          {t('treatmentSessions.execution.expectedEnd', 'Expected end')}{' '}
          {progress.expectedEndDate
            ? new Date(progress.expectedEndDate).toLocaleDateString()
            : '—'}
        </p>
      </div>

      {/* Timeline */}
      <div className="rounded-xl border p-4">
        <h2 className="mb-3 font-semibold">{t('treatmentSessions.execution.progressTimeline', 'Progress timeline')}</h2>
        <div className="space-y-2">
          {(progress.sessions || []).map((s) => (
            <div key={s.id} className="flex items-center gap-3 text-sm">
              <span className="w-16 text-muted-foreground">#{s.sessionIndex}</span>
              <Badge variant="outline">{SESSION_STATUS_LABELS[s.status]}</Badge>
              <span>{s.sessionNumber}</span>
              <span className="text-muted-foreground">
                {s.completedAt
                  ? new Date(s.completedAt).toLocaleDateString()
                  : s.scheduledDate
                    ? new Date(s.scheduledDate).toLocaleDateString()
                    : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* TRT-006 — pre-flight safety gates; "Begin procedure" lives here (not in the generic
          action row) so the technician sees item-by-item pass/fail before committing. */}
      <PermissionGuard
        permissions={[PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL]}
      >
        <SessionPreflightPanel
          sessionId={id}
          session={session}
          isStarting={start.isPending}
          onStart={(extra = {}) =>
            start.mutate({
              deviceUsage: { device: device || session.deviceId, machine: 'Unit 1' },
              ...extra,
            })
          }
        />
      </PermissionGuard>

      {/* Technician workflow actions */}
      <div className="flex flex-wrap gap-2 rounded-xl border p-4">
        <PermissionGuard
          permissions={[PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL]}
        >
          {session.status === 'SCHEDULED' && (
            <Button variant="outline" disabled={checkIn.isPending} onClick={() => checkIn.mutate()}>
              {t('treatmentSessions.execution.checkIn', 'Check in')}
            </Button>
          )}
          {session.status === 'IN_PROGRESS' && (
            <Button variant="outline" disabled={pause.isPending} onClick={() => setShowPauseDialog(true)}>
              {t('treatmentSessions.execution.pause', 'Pause')}
            </Button>
          )}
          {session.status === 'PAUSED' && (
            <Button disabled={resume.isPending} onClick={() => resume.mutate()}>
              {t('treatmentSessions.execution.resume', 'Resume')}
            </Button>
          )}
        </PermissionGuard>
        <PermissionGuard
          permissions={[
            PERMISSIONS.TREATMENT_SESSION_COMPLETE,
            PERMISSIONS.TREATMENT_SESSION_ALL,
          ]}
        >
          {session.status === 'IN_PROGRESS' && (
            <Button
              disabled={complete.isPending}
              onClick={() =>
                complete.mutate({
                  outcome: outcome || t('treatmentSessions.execution.completedSuccessfully', 'Completed successfully'),
                  variationFromPlan: variationFromPlan || undefined,
                  aftercareTemplateId: aftercareTemplateId || undefined,
                  aftercareNotes: aftercareNotes || undefined,
                  painScore: painScore === '' ? undefined : Number(painScore),
                  deviceUsage: buildDeviceUsage(),
                  consumablesUsed: buildConsumablesUsed(),
                  consumables: freeTextConsumables
                    ? freeTextConsumables.split(',').map((s) => s.trim()).filter(Boolean)
                    : undefined,
                  followUp: nextDate
                    ? { nextSessionDate: nextDate, notes: t('treatmentSessions.execution.nextAsPlanned', 'Next as planned') }
                    : undefined,
                })
              }
            >
              {t('treatmentSessions.execution.complete', 'Complete')}
            </Button>
          )}
        </PermissionGuard>
        <PermissionGuard
          permissions={[PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL]}
        >
          {['SCHEDULED', 'CHECKED_IN'].includes(session.status) && (
            <Button variant="outline" disabled={skip.isPending} onClick={() => skip.mutate()}>
              {t('treatmentSessions.execution.skip', 'Skip')}
            </Button>
          )}
          {!['COMPLETED', 'CANCELLED'].includes(session.status) && (
            <Button variant="ghost" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
              {t('treatmentSessions.execution.cancel', 'Cancel')}
            </Button>
          )}
        </PermissionGuard>
      </div>

      {/* Pause reason dialog — mirrors the mandatory-reason modal pattern used by the reception
          queue's transfer/move-up dialogs (QueueBoard.jsx). */}
      {showPauseDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl border bg-card p-5 shadow-lg">
            <h3 className="font-semibold">{t('treatmentSessions.execution.pauseTitle', 'Pause session')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('treatmentSessions.execution.pauseReasonRequired', 'A reason is required to pause (min 3 characters).')}
            </p>
            <Input
              placeholder={t('treatmentSessions.execution.pauseReasonPlaceholder', 'Reason for pausing')}
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPauseDialog(false);
                  setPauseReason('');
                }}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                disabled={pauseReason.trim().length < 3 || pause.isPending}
                onClick={async () => {
                  await pause.mutateAsync({ reason: pauseReason.trim() });
                  setShowPauseDialog(false);
                  setPauseReason('');
                }}
              >
                {t('treatmentSessions.execution.pause', 'Pause')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
        <div>
          <Label>{t('treatmentSessions.execution.devicePlaceholderLabel', 'Device (placeholder)')}</Label>
          <Input
            value={device}
            placeholder={session.deviceUsage?.device || t('treatmentSessions.execution.device', 'Device')}
            onChange={(e) => setDevice(e.target.value)}
          />
        </div>
        <div>
          <Label>{t('treatmentSessions.execution.outcome', 'Outcome')}</Label>
          <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} />
        </div>
        <div>
          <Label>{t('treatmentSessions.execution.nextSessionDate', 'Next session date')}</Label>
          <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
        </div>
        <div>
          <Label>{t('treatmentSessions.execution.variationFromPlan', 'Variation from plan (if any)')}</Label>
          <Input
            value={variationFromPlan}
            onChange={(e) => setVariationFromPlan(e.target.value)}
            placeholder={t('treatmentSessions.execution.variationFromPlanPlaceholder', 'e.g. reduced passes due to sensitivity')}
          />
        </div>
        <div>
          <Label>{t('treatmentSessions.execution.painScore', 'Pain score (0–10)')}</Label>
          <Input
            type="number"
            min={0}
            max={10}
            value={painScore}
            onChange={(e) => setPainScore(e.target.value)}
          />
        </div>
        <div>
          <Label>{t('treatmentSessions.execution.aftercareTemplate', 'Aftercare given (template)')}</Label>
          <Select
            value={aftercareTemplateId}
            onChange={(e) => setAftercareTemplateId(e.target.value)}
          >
            <option value="">{t('treatmentSessions.execution.aftercareTemplateNone', 'None / not protocol-specified')}</option>
            {aftercareOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.procedureName}
                {item.postInstructions ? ` — ${item.postInstructions.slice(0, 40)}${item.postInstructions.length > 40 ? '…' : ''}` : ''}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{t('treatmentSessions.execution.aftercareNotes', 'Aftercare notes (deviation from template)')}</Label>
          <Input
            value={aftercareNotes}
            onChange={(e) => setAftercareNotes(e.target.value)}
            placeholder={t('treatmentSessions.execution.aftercareNotesPlaceholder', 'Optional — anything different from the template')}
          />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label>{t('treatmentSessions.execution.reschedule', 'Reschedule')}</Label>
            <Input
              type="datetime-local"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
            />
          </div>
          <PermissionGuard
            permissions={[PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL]}
          >
            <Button
              variant="outline"
              disabled={!rescheduleDate || reschedule.isPending}
              onClick={() => reschedule.mutate(new Date(rescheduleDate).toISOString())}
            >
              {t('treatmentSessions.execution.save', 'Save')}
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Device parameters — typed fields backed by deviceUsage.settings; all optional since not
          every protocol/device uses every field. Anything outside this common set goes in the
          generic "Other parameters" key-value area (customParameters). */}
      <div className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">{t('treatmentSessions.execution.deviceParameters', 'Device parameters')}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>{t('treatmentSessions.execution.wavelength', 'Wavelength (nm)')}</Label>
            <Input
              type="number"
              value={settings.wavelength}
              onChange={(e) => setSettings((s) => ({ ...s, wavelength: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t('treatmentSessions.execution.fluence', 'Fluence (J/cm²)')}</Label>
            <Input
              type="number"
              value={settings.fluence}
              onChange={(e) => setSettings((s) => ({ ...s, fluence: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t('treatmentSessions.execution.pulseWidth', 'Pulse width (ms)')}</Label>
            <Input
              type="number"
              value={settings.pulseWidth}
              onChange={(e) => setSettings((s) => ({ ...s, pulseWidth: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t('treatmentSessions.execution.spotSize', 'Spot size (mm)')}</Label>
            <Input
              type="number"
              value={settings.spotSize}
              onChange={(e) => setSettings((s) => ({ ...s, spotSize: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t('treatmentSessions.execution.coolingSetting', 'Cooling setting')}</Label>
            <Input
              value={settings.coolingSetting}
              onChange={(e) => setSettings((s) => ({ ...s, coolingSetting: e.target.value }))}
            />
          </div>
          <div>
            <Label>{t('treatmentSessions.execution.passes', 'Passes')}</Label>
            <Input
              type="number"
              value={settings.passes}
              onChange={(e) => setSettings((s) => ({ ...s, passes: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('treatmentSessions.execution.otherParameters', 'Other parameters')}</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCustomParams((rows) => [...rows, { key: '', value: '' }])}
            >
              <Plus className="h-4 w-4" />
              {t('treatmentSessions.execution.addParameter', 'Add')}
            </Button>
          </div>
          {customParams.map((row, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                placeholder={t('treatmentSessions.execution.parameterKey', 'Name')}
                value={row.key}
                onChange={(e) =>
                  setCustomParams((rows) => rows.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r)))
                }
              />
              <Input
                placeholder={t('treatmentSessions.execution.parameterValue', 'Value')}
                value={row.value}
                onChange={(e) =>
                  setCustomParams((rows) => rows.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))
                }
              />
              <Button variant="ghost" size="sm" onClick={() => setCustomParams((rows) => rows.filter((_, i) => i !== idx))}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Consumables used at completion. Batch-linked lines are preferred (decrement real stock,
          FEFO-suggested batch first — same idea as the pharmacy dispense screen's "Auto FEFO");
          the free-text field stays as a simple fallback for anything not tracked in inventory. */}
      <div className="space-y-3 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('treatmentSessions.execution.consumablesUsed', 'Consumables used')}</h2>
          <PermissionGuard
            permissions={[PERMISSIONS.TREATMENT_SESSION_COMPLETE, PERMISSIONS.TREATMENT_SESSION_ALL]}
          >
            <Button variant="ghost" size="sm" onClick={addConsumableLine}>
              <Plus className="h-4 w-4" />
              {t('treatmentSessions.execution.addConsumable', 'Add consumable')}
            </Button>
          </PermissionGuard>
        </div>

        {consumableLines.map((line, idx) => {
          const selected = invItems.find((i) => i.id === line.inventoryItemId);
          const batches = selected?.batches || [];
          return (
            <div key={idx} className="grid gap-2 sm:grid-cols-[2fr_2fr_1fr_auto] sm:items-end">
              <div>
                <Label>{t('treatmentSessions.execution.consumableItem', 'Item')}</Label>
                <SearchableCombobox
                  value={line.inventoryItemId}
                  onChange={(id) => updateConsumableLine(idx, { inventoryItemId: id, batchNumber: '' })}
                  options={invItems}
                  filterKeys={['name']}
                  renderLabel={(i) => i.name}
                  renderSublabel={(i) => `${t('treatmentSessions.execution.stock', 'stock')} ${i.currentStock}`}
                  placeholder={t('treatmentSessions.execution.selectConsumable', 'Select item')}
                  emptyText={t('treatmentSessions.execution.selectConsumable', 'Select item')}
                />
              </div>
              <div>
                <Label>{t('treatmentSessions.execution.consumableBatch', 'Batch')}</Label>
                <Select
                  value={line.batchNumber}
                  onChange={(e) => updateConsumableLine(idx, { batchNumber: e.target.value })}
                >
                  <option value="">{t('treatmentSessions.execution.autoFefo', 'Auto FEFO')}</option>
                  {batches.map((b) => (
                    <option key={b.batchNumber} value={b.batchNumber}>
                      {b.batchNumber} · {t('treatmentSessions.execution.qty', 'qty')} {b.quantity} ·{' '}
                      {t('treatmentSessions.execution.exp', 'exp')}{' '}
                      {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : '—'}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>{t('treatmentSessions.execution.consumableQty', 'Qty')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={line.quantity}
                  onChange={(e) => updateConsumableLine(idx, { quantity: e.target.value })}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeConsumableLine(idx)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        <div>
          <Label>{t('treatmentSessions.execution.consumablesFreeText', 'Other consumables (free text, comma separated)')}</Label>
          <Input
            value={freeTextConsumables}
            placeholder={t('treatmentSessions.execution.consumablesFreeTextPlaceholder', 'e.g. gauze, cooling gel')}
            onChange={(e) => setFreeTextConsumables(e.target.value)}
          />
        </div>
      </div>

      {/* Photo comparison */}
      <div className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">{t('treatmentSessions.execution.beforeAfter', 'Before / After')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">{t('treatmentSessions.execution.before', 'Before')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(session.photosBefore || []).map((p) => (
                <img
                  key={p.id || p.storageKey}
                  src={`${APP_CONFIG.apiOrigin}${p.url}`}
                  alt={p.title || t('treatmentSessions.execution.before', 'Before')}
                  className="h-28 w-full rounded-lg object-cover border"
                />
              ))}
            </div>
            <PermissionGuard
              permissions={[PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL]}
            >
              <Input
                className="mt-2"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate({ file, photoType: 'BEFORE' });
                }}
              />
            </PermissionGuard>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">{t('treatmentSessions.execution.after', 'After')}</p>
            <div className="grid grid-cols-2 gap-2">
              {(session.photosAfter || []).map((p) => (
                <img
                  key={p.id || p.storageKey}
                  src={`${APP_CONFIG.apiOrigin}${p.url}`}
                  alt={p.title || t('treatmentSessions.execution.after', 'After')}
                  className="h-28 w-full rounded-lg object-cover border"
                />
              ))}
            </div>
            <PermissionGuard
              permissions={[PERMISSIONS.TREATMENT_SESSION_EDIT, PERMISSIONS.TREATMENT_SESSION_ALL]}
            >
              <Input
                className="mt-2"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) upload.mutate({ file, photoType: 'AFTER' });
                }}
              />
            </PermissionGuard>
          </div>
        </div>
      </div>

      {/* Pause history */}
      {(session.pauseHistory || []).length > 0 && (
        <div className="space-y-2 rounded-xl border p-4">
          <h2 className="font-semibold">{t('treatmentSessions.execution.pauseHistory', 'Pause history')}</h2>
          {session.pauseHistory.map((p, idx) => (
            <div key={idx} className="border-b border-dashed py-2 text-sm last:border-0">
              <p>
                {p.pausedAt ? new Date(p.pausedAt).toLocaleString() : '—'}
                {p.resumedAt ? ` → ${new Date(p.resumedAt).toLocaleString()}` : ` (${t('treatmentSessions.execution.stillPaused', 'still paused')})`}
              </p>
              <p className="text-muted-foreground">{p.reason}</p>
            </div>
          ))}
        </div>
      )}

      {/* Consumables actually used (batch-linked) */}
      {(session.consumablesUsed || []).length > 0 && (
        <div className="space-y-2 rounded-xl border p-4">
          <h2 className="font-semibold">{t('treatmentSessions.execution.consumablesUsedRecord', 'Consumables used (record)')}</h2>
          {session.consumablesUsed.map((c, idx) => (
            <div key={idx} className="flex items-center justify-between border-b border-dashed py-2 text-sm last:border-0">
              <span>{c.productName || '—'}</span>
              <span className="text-muted-foreground">
                {c.batchNumber ? `${t('treatmentSessions.execution.consumableBatch', 'Batch')} ${c.batchNumber} · ` : ''}
                {t('treatmentSessions.execution.qty', 'qty')} {c.quantity ?? '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Session log */}
      <div className="space-y-2 rounded-xl border p-4">
        <h2 className="font-semibold">{t('treatmentSessions.execution.sessionLog', 'Session log')}</h2>
        {(session.logs || []).map((l) => (
          <div key={l.id} className="border-b border-dashed py-2 text-sm">
            <p>
              {l.startTime ? new Date(l.startTime).toLocaleString() : '—'}
              {l.endTime ? ` → ${new Date(l.endTime).toLocaleString()}` : ''}
            </p>
            <p className="text-muted-foreground">
              {l.operatorName || t('treatmentSessions.execution.operator', 'Operator')} · {l.deviceUsed || '—'} ·{' '}
              {l.outcome || l.notes || ''}
            </p>
          </div>
        ))}
        {!session.logs?.length && (
          <p className="text-sm text-muted-foreground">
            {t('treatmentSessions.execution.noLogEntries', 'No log entries yet.')}
          </p>
        )}
      </div>

      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        {t('treatmentSessions.execution.invoice', 'Invoice')} {session.invoice?.invoiceNumber || session.invoiceId} ·{' '}
        {session.invoice?.paymentStatus || '—'} · {t('treatmentSessions.execution.plan', 'Plan')}{' '}
        {session.treatmentPlan?.planNumber} (
        {t('treatmentSessions.execution.notModifiedByExecution', 'not modified by execution')})
      </div>
    </section>
  );
}
