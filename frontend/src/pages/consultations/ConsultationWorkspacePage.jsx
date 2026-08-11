import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Lock, PenLine } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { cn } from '@/utils/cn';
import { useQuery } from '@tanstack/react-query';
import {
  useConsultationWorkspace,
  usePatientConsultationSummary,
  useSignConsultation,
  useLockConsultation,
  useUpdateConsultation,
} from '@/modules/consultations/hooks/useConsultations';
import consentApi from '@/modules/reception/api/consentApi';
import { useInsertTarget } from '@/modules/consultations/hooks/useInsertTarget';
import { INSERT_TARGETS, appendText, resetInsertQueue } from '@/modules/consultations/insertBus';
import { SoapEditor } from '@/modules/consultations/components/SoapEditor';
import { VitalsForm } from '@/modules/consultations/components/VitalsForm';
import { ExaminationForm } from '@/modules/consultations/components/DiagnosisExamForms';
import { ClinicalPhotosPanel } from '@/modules/consultations/components/ClinicalPhotosPanel';
import { LabOrdersPanel } from '@/modules/consultations/components/LabOrdersPanel';
import { TreatmentOrderPanel } from '@/modules/consultations/components/TreatmentOrderPanel';
import { AiCopilotPanel } from '@/modules/consultations/components/AiCopilotPanel';
import { ReleaseSummaryPanel } from '@/modules/consultations/components/ReleaseSummaryPanel';
import { PrescriptionDraftPanel } from '@/modules/consultations/components/PrescriptionDraftPanel';
import {
  PatientSummarySidebar,
  TimelinePanel,
} from '@/modules/consultations/components/PatientPanels';
import {
  ConsultationStatusBadge,
} from '@/modules/consultations/components/StatusBadges';
import {
  CONTEXT_SECTIONS,
  FOLLOW_UP_UNITS,
  FOLLOW_UP_PRIORITIES,
  RECORD_SECTIONS,
} from '@/modules/consultations/constants';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { useAuth } from '@/contexts/AuthContext';

/** Which section an accepted AI insertion landed in, so its tab can flag itself. */
const TARGET_SECTION = {
  [INSERT_TARGETS.SOAP_SUBJECTIVE]: 'soap',
  [INSERT_TARGETS.SOAP_OBJECTIVE]: 'soap',
  [INSERT_TARGETS.SOAP_ASSESSMENT]: 'soap',
  [INSERT_TARGETS.SOAP_PLAN]: 'soap',
  // Diagnosis now lives inside the SOAP tab's Assessment section (§3.1) — flag the same tab.
  [INSERT_TARGETS.DIAGNOSIS]: 'soap',
  [INSERT_TARGETS.FOLLOW_UP_INSTRUCTIONS]: 'followup',
  [INSERT_TARGETS.LAB_ORDER]: 'labs',
  [INSERT_TARGETS.PRESCRIPTION_LINE]: 'rx',
};

const ALL_SECTIONS = [...CONTEXT_SECTIONS, ...RECORD_SECTIONS];
const ALL_SECTION_IDS = ALL_SECTIONS.map((s) => s.id);

/**
 * Declared at module scope on purpose: a component defined inside the page body would get a new
 * identity on every render, remounting its subtree and throwing away in-progress form state.
 */
/**
 * One horizontally-scrolling tab row with an arrow at each end. The arrows exist because the ten
 * sections do not fit the half-width column at common laptop sizes, and a wrapping strip pushed
 * the panel down by two rows. Each arrow disables itself at its end of the track so it never
 * looks clickable when it would do nothing.
 */
function SectionTabStrip({ children }) {
  const trackRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    // 1px tolerance: fractional scroll widths never settle exactly on `max`.
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sync]);

  const nudge = (direction) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(160, el.clientWidth * 0.6), behavior: 'smooth' });
  };

  return (
    <div className="flex shrink-0 items-center gap-1 border-b p-2">
      <ArrowButton direction="left" disabled={atStart} onClick={() => nudge(-1)} />
      <div
        ref={trackRef}
        onScroll={sync}
        role="tablist"
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <ArrowButton direction="right" disabled={atEnd} onClick={() => nudge(1)} />
    </div>
  );
}

function ArrowButton({ direction, disabled, onClick }) {
  const { t } = useTranslation();
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={
        direction === 'left'
          ? t('consultations.workspace.scrollTabsLeft', 'Scroll tabs left')
          : t('consultations.workspace.scrollTabsRight', 'Scroll tabs right')
      }
      className={cn(
        'shrink-0 rounded-md border p-1.5 text-muted-foreground transition',
        disabled ? 'cursor-default opacity-30' : 'hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function SectionTab({ sectionId, label, active, flagged, flagTitle, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(sectionId)}
      className={cn(
        // shrink-0 + nowrap keep every tab on the single scrolling row instead of squeezing.
        'relative shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
      )}
      role="tab"
      aria-selected={active}
    >
      {label}
      {flagged && !active && (
        <span
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-info"
          title={flagTitle}
        />
      )}
    </button>
  );
}

/** Inactive panels stay mounted but hidden so in-progress edits are never thrown away. */
function Panel({ active, children }) {
  return <div className={active ? 'block' : 'hidden'}>{children}</div>;
}

/**
 * Mirrors `Patient.model.js#computeAge` (whole-years-as-of-today, DOB-month/day aware). The
 * consultation workspace's embedded `patient` sub-document (see ConsultationService#map) only
 * carries `dateOfBirth`, not the `age` virtual `toSafeObject()` adds elsewhere — so it's
 * recomputed here rather than pulling in a heavier patient-record fetch just for one number.
 */
function computeAgeFromDob(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

/**
 * §3 sticky patient-context header — MRN · age · allergies/warnings · branch · reason ·
 * follow-up · consent. Pinned above the tab strip (not inside any tab), so it stays visible no
 * matter which of the ten sections the doctor is on. Kept to a single dense badge row rather than
 * a card, matching the `Badge`-pill language used elsewhere in this module (StatusBadges.jsx).
 */
function PatientContextHeader({ consultation, patientId }) {
  const { t } = useTranslation();
  const patient = consultation?.patient;
  const age = computeAgeFromDob(patient?.dateOfBirth);
  const allergies = patient?.allergies;
  const hasAllergies = Boolean(allergies && String(allergies).trim());

  // Lightest existing read for consent — same per-patient endpoint the reception desk uses
  // (GET /consent/patients/:patientId); no bulk fetch or new plumbing added.
  const consentQuery = useQuery({
    queryKey: ['consent', 'patient', patientId],
    queryFn: () => consentApi.currentStates(patientId),
    enabled: Boolean(patientId),
    staleTime: 60_000,
  });
  const consentStates = consentQuery.data?.data?.states || [];
  const relevantConsents = consentStates.filter((c) => c.state && c.state !== 'NOT_SET');
  const hasConsentGranted = relevantConsents.length > 0 && relevantConsents.every((c) => c.state === 'GRANTED');
  const consentLabel = consentQuery.isLoading
    ? t('common.loading', 'Loading…')
    : relevantConsents.length
      ? hasConsentGranted
        ? t('consultations.workspace.consentOnFile', 'On file')
        : t('consultations.workspace.consentPending', 'Pending')
      : t('consultations.workspace.consentNone', 'Not recorded');

  const followUp = consultation?.followUp;
  const followUpLabel = followUp?.value
    ? `${followUp.value} ${(followUp.unit || '').toLowerCase()}`
    : t('consultations.workspace.followUpNotSet', 'Not set');

  return (
    <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-1.5 rounded-lg border bg-card/95 px-3 py-2 text-xs backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <HeaderField label={t('consultations.workspace.mrn', 'MRN')}>
        {patient?.mrn || '—'}
      </HeaderField>
      <HeaderField label={t('consultations.workspace.age', 'Age')}>
        {age != null ? age : '—'}
      </HeaderField>
      <Badge
        variant={hasAllergies ? 'destructive' : 'outline'}
        className="px-2 py-0.5 text-[11px] font-medium"
        title={hasAllergies ? String(allergies) : undefined}
      >
        {hasAllergies
          ? `${t('consultations.workspace.allergies', 'Allergies')}: ${allergies}`
          : t('consultations.workspace.noAllergies', 'No known allergies')}
      </Badge>
      <HeaderField label={t('consultations.workspace.branch', 'Branch')}>
        {consultation?.branch?.name || '—'}
      </HeaderField>
      <HeaderField label={t('consultations.workspace.reason', 'Reason')}>
        <span className="max-w-[16rem] truncate" title={consultation?.chiefComplaint || undefined}>
          {consultation?.chiefComplaint || '—'}
        </span>
      </HeaderField>
      <Badge variant="outline" className="px-2 py-0.5 text-[11px] font-medium">
        {t('consultations.workspace.followUp', 'Follow-up')}: {followUpLabel}
      </Badge>
      <Badge
        variant={hasConsentGranted ? 'success' : relevantConsents.length ? 'warning' : 'outline'}
        className="px-2 py-0.5 text-[11px] font-medium"
      >
        {t('consultations.workspace.consent', 'Consent')}: {consentLabel}
      </Badge>
    </div>
  );
}

function HeaderField({ label, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 font-medium text-muted-foreground">
      <span className="uppercase tracking-wide text-[10px] text-muted-foreground/70">{label}</span>
      <span className="text-foreground">{children}</span>
    </span>
  );
}

/**
 * The in-cabin consultation cockpit.
 *
 * Two halves on desktop: the AI copilot on the left, and ONE tabbed section on the right holding
 * both patient context (Summary, Timeline) and the clinical record (SOAP … Follow-up). The copilot
 * is never a tab, so the doctor reads a suggestion and types into the note at the same time; each
 * half scrolls independently so neither scrolls the other out of view. Below `lg` the halves stack
 * with the copilot first.
 *
 * The record/context panels all stay mounted (inactive ones are CSS-hidden), so unsaved edits and
 * AI-accepted text survive tab switching.
 */
export default function ConsultationWorkspacePage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useAuth();
  const { data, isLoading, isError, error } = useConsultationWorkspace(id);
  const consultation = data?.consultation;
  const patientId = consultation?.patientId;
  const summaryQuery = usePatientConsultationSummary(patientId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [insertedInto, setInsertedInto] = useState({});

  // Deep-linkable / reload-safe active tab: /consultations/:id?section=diagnosis
  const requested = searchParams.get('section');
  const tab = ALL_SECTION_IDS.includes(requested) ? requested : 'soap';

  const sign = useSignConsultation(id);
  const lock = useLockConsultation(id);
  const update = useUpdateConsultation(id);

  // Drop anything queued for a section that never mounted when leaving the workspace.
  useEffect(() => () => resetInsertQueue(), [id]);

  const readOnly = useMemo(() => {
    if (!consultation) return true;
    return (
      consultation.locked ||
      consultation.status === 'SIGNED' ||
      consultation.status === 'LOCKED'
    );
  }, [consultation]);

  const [followUp, setFollowUp] = useState({
    value: '',
    unit: 'WEEKS',
    reason: '',
    instructions: '',
    priority: 'NORMAL',
    preferredDoctorId: '',
    preferredBranchId: '',
    reminderDate: '',
    reminderNote: '',
  });

  useEffect(() => {
    if (consultation?.followUp) {
      setFollowUp({
        value: consultation.followUp.value ?? '',
        unit: consultation.followUp.unit || 'WEEKS',
        reason: consultation.followUp.reason || '',
        instructions: consultation.followUp.instructions || '',
        priority: consultation.followUp.priority || 'NORMAL',
        preferredDoctorId: consultation.followUp.preferredDoctorId || '',
        preferredBranchId: consultation.followUp.preferredBranchId || '',
        reminderDate: consultation.followUp.reminderDate
          ? new Date(consultation.followUp.reminderDate).toISOString().slice(0, 10)
          : '',
        reminderNote: consultation.followUp.reminderNote || '',
      });
    }
  }, [consultation?.id]);

  // §3.6 — preferred doctor/branch pickers for the follow-up order.
  const { data: followUpDoctorsData } = useDoctorList({ limit: 100 });
  const followUpDoctors = followUpDoctorsData?.items || [];
  const { data: followUpBranchesData } = useBranchList({ limit: 100 });
  const followUpBranches = followUpBranchesData?.items || [];

  /** Patient-instruction inserts append to the follow-up instructions box, unsaved and editable. */
  useInsertTarget(
    INSERT_TARGETS.FOLLOW_UP_INSTRUCTIONS,
    ({ text }) => setFollowUp((prev) => ({ ...prev, instructions: appendText(prev.instructions, text) })),
    !readOnly
  );

  const onAiInsert = useCallback((target) => {
    const section = TARGET_SECTION[target];
    if (section) setInsertedInto((prev) => ({ ...prev, [section]: true }));
  }, []);

  const selectTab = (next) => {
    const params = new URLSearchParams(searchParams);
    params.set('section', next);
    setSearchParams(params, { replace: true });
    setInsertedInto((prev) => (prev[next] ? { ...prev, [next]: false } : prev));
  };

  const sectionLabel = (sectionId) =>
    t(
      `consultations.tabs.${sectionId}`,
      ALL_SECTIONS.find((s) => s.id === sectionId)?.label || sectionId
    );
  const followUpUnitLabel = (unit) =>
    t(`consultations.followUp.units.${unit}`, FOLLOW_UP_UNITS.find((u) => u.value === unit)?.label || unit);

  if (isLoading) {
    return <p className="p-6 text-sm text-muted-foreground">{t('consultations.workspace.loading', 'Loading workspace…')}</p>;
  }
  if (isError || !consultation) {
    return (
      <p className="p-6 text-sm text-destructive">
        {error?.response?.data?.message || t('consultations.workspace.notFound', 'Consultation not found')}
      </p>
    );
  }

  const renderTab = (section) => (
    <SectionTab
      key={section.id}
      sectionId={section.id}
      label={sectionLabel(section.id)}
      active={tab === section.id}
      flagged={Boolean(insertedInto[section.id])}
      flagTitle={t('consultations.workspace.pendingInsert', 'AI text inserted here — review it')}
      onSelect={selectTab}
    />
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border/70 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link to={APP_ROUTES.CONSULTATIONS}>
              <ArrowLeft className="h-4 w-4" />
              {t('common.back', 'Back')}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold text-primary">
              {consultation.consultationNumber}
            </h1>
            <ConsultationStatusBadge status={consultation.status} />
            {readOnly && (
              <span className="text-xs font-medium text-muted-foreground">
                {t('consultations.workspace.immutable', 'Immutable')}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {consultation.patient?.fullName} · {t('consultations.workspace.doctorPrefix', 'Dr.')} {consultation.doctor?.name || '—'} ·{' '}
            {consultation.appointment?.appointmentNumber}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <PermissionGuard permissions={[PERMISSIONS.CONSULTATION_SIGN, PERMISSIONS.CONSULTATION_ALL]}>
              <Button onClick={() => sign.mutate()} disabled={sign.isPending}>
                <PenLine className="h-4 w-4" />
                {t('consultations.workspace.sign', 'Sign')}
              </Button>
            </PermissionGuard>
          )}
          {consultation.status === 'SIGNED' && !consultation.locked && (
            <PermissionGuard permissions={[PERMISSIONS.CONSULTATION_LOCK, PERMISSIONS.CONSULTATION_ALL]}>
              <Button variant="outline" onClick={() => lock.mutate()} disabled={lock.isPending}>
                <Lock className="h-4 w-4" />
                {t('consultations.workspace.lock', 'Lock')}
              </Button>
            </PermissionGuard>
          )}
          <PermissionGuard permissions={[PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL]}>
            <Button asChild variant="outline">
              <Link to={`${APP_ROUTES.PRESCRIPTIONS}?consultationId=${consultation.id}`}>
                {t('nav.prescriptions', 'Prescriptions')}
              </Link>
            </Button>
          </PermissionGuard>
          <PermissionGuard
            permissions={[PERMISSIONS.TREATMENT_PLAN_VIEW, PERMISSIONS.TREATMENT_PLAN_ALL]}
          >
            <Button asChild variant="outline">
              <Link to={`${APP_ROUTES.TREATMENT_PLANS}?consultationId=${consultation.id}`}>
                {t('nav.treatmentPlans', 'Treatment plans')}
              </Link>
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <PatientContextHeader consultation={consultation} patientId={patientId} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* PRIMARY half — the copilot is always on screen, never behind a tab. */}
        <div className="min-h-0 lg:h-[calc(100vh-13rem)]">
          <AiCopilotPanel
            consultationId={id}
            patientId={patientId}
            readOnly={readOnly}
            chiefComplaint={consultation?.chiefComplaint}
            onInsert={onAiInsert}
          />
        </div>

        {/* One tabbed section: patient context first, then the clinical record. */}
        <div className="flex min-h-0 flex-col rounded-xl border bg-card lg:h-[calc(100vh-13rem)]">
          <SectionTabStrip>{ALL_SECTIONS.map(renderTab)}</SectionTabStrip>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <Panel active={tab === 'summary'}>
              <PatientSummarySidebar
                summary={summaryQuery.data}
                loading={summaryQuery.isLoading}
              />
            </Panel>
            <Panel active={tab === 'timeline'}>
              <TimelinePanel summary={summaryQuery.data} loading={summaryQuery.isLoading} />
            </Panel>
            <Panel active={tab === 'soap'}>
              <SoapEditor
                consultationId={id}
                soap={data.soap}
                diagnosis={data.diagnosis}
                readOnly={readOnly}
              />
            </Panel>
            <Panel active={tab === 'vitals'}>
              <VitalsForm consultationId={id} vitals={data.vitals} readOnly={readOnly} />
            </Panel>
            <Panel active={tab === 'exam'}>
              <ExaminationForm
                consultationId={id}
                examination={data.examination}
                readOnly={readOnly}
              />
            </Panel>
            <Panel active={tab === 'rx'}>
              <PrescriptionDraftPanel consultationId={id} readOnly={readOnly} />
            </Panel>
            <Panel active={tab === 'photos'}>
              <ClinicalPhotosPanel
                consultationId={id}
                photos={data.photos || []}
                readOnly={readOnly}
              />
            </Panel>
            <Panel active={tab === 'labs'}>
              <LabOrdersPanel consultationId={id} readOnly={readOnly} />
            </Panel>
            <Panel active={tab === 'treatment'}>
              <TreatmentOrderPanel consultationId={id} patientId={patientId} readOnly={readOnly} />
            </Panel>
            <Panel active={tab === 'followup'}>
              <div className="space-y-3">
                <h3 className="font-semibold">{t('consultations.followUp.title', 'Follow-up recommendation')}</h3>
                <p className="text-xs text-muted-foreground">
                  {t(
                    'consultations.followUp.hint',
                    'Structured follow-up order — a reminder date/note is set here; the appointment module will own actual scheduling and delivery later.'
                  )}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>{t('consultations.followUp.value', 'Value')}</Label>
                    <Input
                      type="number"
                      value={followUp.value}
                      disabled={readOnly}
                      onChange={(e) => setFollowUp((p) => ({ ...p, value: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('consultations.followUp.unit', 'Unit')}</Label>
                    <Select
                      value={followUp.unit}
                      disabled={readOnly}
                      onChange={(e) => setFollowUp((p) => ({ ...p, unit: e.target.value }))}
                    >
                      {FOLLOW_UP_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>
                          {followUpUnitLabel(u.value)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{t('consultations.followUp.reason', 'Reason')}</Label>
                  <Input
                    value={followUp.reason}
                    disabled={readOnly}
                    onChange={(e) => setFollowUp((p) => ({ ...p, reason: e.target.value }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label>{t('consultations.followUp.priority', 'Priority')}</Label>
                    <Select
                      value={followUp.priority}
                      disabled={readOnly}
                      onChange={(e) => setFollowUp((p) => ({ ...p, priority: e.target.value }))}
                    >
                      {FOLLOW_UP_PRIORITIES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {t(`consultations.followUp.priorities.${p.value}`, p.label)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{t('consultations.followUp.preferredDoctor', 'Preferred doctor')}</Label>
                    <Select
                      value={followUp.preferredDoctorId}
                      disabled={readOnly}
                      onChange={(e) => setFollowUp((p) => ({ ...p, preferredDoctorId: e.target.value }))}
                    >
                      <option value="">{t('consultations.followUp.anyDoctor', 'Any')}</option>
                      {followUpDoctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.doctorCode} — {d.user?.fullName || t('consultations.followUp.doctorFallback', 'Doctor')}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{t('consultations.followUp.preferredBranch', 'Preferred branch')}</Label>
                    <Select
                      value={followUp.preferredBranchId}
                      disabled={readOnly}
                      onChange={(e) => setFollowUp((p) => ({ ...p, preferredBranchId: e.target.value }))}
                    >
                      <option value="">{t('consultations.followUp.anyBranch', 'Any')}</option>
                      {followUpBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.displayName || b.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>{t('consultations.followUp.reminderDate', 'Reminder date')}</Label>
                    <Input
                      type="date"
                      value={followUp.reminderDate}
                      disabled={readOnly}
                      onChange={(e) => setFollowUp((p) => ({ ...p, reminderDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('consultations.followUp.reminderNote', 'Reminder note')}</Label>
                    <Input
                      value={followUp.reminderNote}
                      disabled={readOnly}
                      onChange={(e) => setFollowUp((p) => ({ ...p, reminderNote: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>
                    {t('consultations.followUp.instructions', 'Instructions')}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      {t('consultations.followUp.instructionsAiHint', '(accepted AI advice appends here — edit before saving)')}
                    </span>
                  </Label>
                  <textarea
                    className="min-h-[140px] w-full rounded-lg border px-3 py-2 text-sm"
                    value={followUp.instructions}
                    disabled={readOnly}
                    onChange={(e) =>
                      setFollowUp((p) => ({ ...p, instructions: e.target.value }))
                    }
                  />
                </div>
                {!readOnly && (
                  <Button
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({
                        followUp: {
                          value: followUp.value ? Number(followUp.value) : null,
                          unit: followUp.unit,
                          reason: followUp.reason || null,
                          instructions: followUp.instructions || null,
                          priority: followUp.priority || null,
                          preferredDoctorId: followUp.preferredDoctorId || null,
                          preferredBranchId: followUp.preferredBranchId || null,
                          reminderDate: followUp.reminderDate || null,
                          reminderNote: followUp.reminderNote || null,
                        },
                      })
                    }
                  >
                    {t('consultations.followUp.save', 'Save follow-up')}
                  </Button>
                )}
                {user?.role === 'OWNER' && consultation.locked && (
                  <p className="text-xs text-muted-foreground">
                    {t('consultations.followUp.unlockNote', 'Unlock is available via API for Owner only.')}
                  </p>
                )}
              </div>
            </Panel>
            <Panel active={tab === 'release'}>
              <ReleaseSummaryPanel
                consultationId={id}
                soap={data.soap}
                diagnosis={data.diagnosis}
                followUp={followUp}
                consultation={consultation}
              />
            </Panel>
          </div>
        </div>
      </div>
    </section>
  );
}
