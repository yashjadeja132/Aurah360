import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants/rbac';
import { usePatientDetail } from '@/modules/patients/hooks/usePatients';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { usePatientAppointmentHistory } from '../hooks/useAppointments';
import { useBookingSubmit } from '../hooks/useBookingSubmit';
import { BookingWizard } from './BookingWizard';
// 'Today' must come from the LOCAL calendar day: a UTC slice returns YESTERDAY between 00:00
// and 05:30 IST, so a view opened before dawn silently loaded the wrong day. See '@/utils/date'.
import { todayKey } from '@/utils/date';
import {
  BranchPicker,
  DoctorPicker,
  ServicePicker,
  SlotPicker,
  PatientPicker,
} from './bookingPickers';

/**
 * A visit that actually happened is the best template; a cancellation or a
 * no-show is the worst. Rank the patient's history so pre-fill copies the
 * most recent *real* visit, falling back only if nothing better exists.
 */
const TEMPLATE_RANK = { COMPLETED: 0, CHECKED_IN: 1, IN_PROGRESS: 1, CONFIRMED: 2, SCHEDULED: 2 };
const POOR_TEMPLATE_RANK = 5;

function pickTemplate(history) {
  const usable = (history || []).filter((a) => a.branchId && a.doctorId && a.serviceId);
  if (!usable.length) return null;
  // The API sorts appointmentDate/startTime descending, but do not rely on it.
  const byRecency = [...usable].sort((a, b) => {
    const d = new Date(b.appointmentDate) - new Date(a.appointmentDate);
    if (d !== 0) return d;
    return String(b.startTime || '').localeCompare(String(a.startTime || ''));
  });
  return [...byRecency].sort(
    (a, b) =>
      (TEMPLATE_RANK[a.status] ?? POOR_TEMPLATE_RANK) -
      (TEMPLATE_RANK[b.status] ?? POOR_TEMPLATE_RANK)
  )[0];
}

// `locked` removes the "Change" affordance entirely (not just defaults to collapsed) — for a
// branch-scoped staff member's own branch, there is genuinely nothing to change here: the
// backend will 403 any other branch on submit regardless, so offering an edit control that
// only ever leads to a rejected booking is worse than not offering it at all.
function SummaryRow({ label, value, changeLabel, isEditing, onChange, children, locked = false }) {
  return (
    <div className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {!isEditing && <p className="truncate text-sm font-medium text-foreground">{value}</p>}
      </div>
      {isEditing ? (
        <div className="w-full sm:max-w-xs">{children}</div>
      ) : !locked ? (
        <Button type="button" variant="ghost" size="sm" onClick={onChange}>
          {changeLabel}
        </Button>
      ) : null}
    </div>
  );
}

// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES.
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];

export function QuickBookingPanel({ onCreated, initialPatientId = '' }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  // A branch-scoped staff member can only ever book at their own branch (the backend enforces
  // this on submit regardless), so their branch is never editable here even if the patient's
  // last-visit template points elsewhere — same reasoning as BookingWizard's branch skip.
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const ownBranchId = !isGlobalScope ? user?.branch || '' : '';

  const [patientId, setPatientId] = useState(initialPatientId);
  const [patientSearch, setPatientSearch] = useState('');
  const [changingPatient, setChangingPatient] = useState(false);

  const [branchId, setBranchId] = useState(ownBranchId);
  const [doctorId, setDoctorId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [editing, setEditing] = useState({ branch: false, doctor: false, service: false });
  const [labels, setLabels] = useState({ branch: '', doctor: '', service: '' });

  const [date, setDate] = useState(todayKey());
  const [slot, setSlot] = useState(null);
  const [showExtras, setShowExtras] = useState(false);
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [notes, setNotes] = useState('');

  const { data: patient } = usePatientDetail(patientId || undefined);
  const {
    data: history,
    isLoading: loadingHistory,
    isSuccess: historyLoaded,
  } = usePatientAppointmentHistory(patientId || undefined);
  const { submit, isPending } = useBookingSubmit(onCreated);

  const historyTemplate = useMemo(() => pickTemplate(history), [history]);

  // Same lists BranchPicker/DoctorPicker fetch elsewhere on this page (small, cached — neither
  // hook supports a conditional `enabled` gate, and these are cheap enough not to need one) —
  // used both to resolve the locked own-branch's display name and, when there's no visit
  // history yet, to resolve names for a primary-record fallback template.
  const needsPrimaryFallback = !historyTemplate && Boolean(patient?.primaryDoctorId || patient?.primaryBranchId);
  const { data: branchesData } = useBranchList({ limit: 50 });
  const { data: doctorsData } = useDoctorList({ limit: 50 });

  // A patient can have a known preferred doctor/branch (set at registration —
  // Patient.primaryDoctorId/primaryBranchId) even with zero appointment history yet — that's
  // still "we already know this," not "first visit," so it should pre-fill exactly like a real
  // visit template would. Only fall back to genuinely asking (BookingWizard's firstTime path)
  // when NEITHER a visit history NOR a primary record exists.
  const template = useMemo(() => {
    if (historyTemplate) return historyTemplate;
    if (!needsPrimaryFallback) return null;
    const branch = branchesData?.items?.find((b) => b.id === patient.primaryBranchId);
    const doctor = doctorsData?.items?.find((d) => d.id === patient.primaryDoctorId);
    return {
      branchId: patient.primaryBranchId || '',
      doctorId: patient.primaryDoctorId || '',
      serviceId: '',
      branch: branch ? { name: branch.displayName || branch.name } : null,
      doctor: doctor ? { name: doctor.user?.fullName, doctorCode: doctor.doctorCode } : null,
      service: null,
    };
  }, [historyTemplate, needsPrimaryFallback, branchesData, doctorsData, patient]);

  // Pre-fill branch / doctor / service from the patient's last real visit, or their known
  // primary doctor/branch when there's no visit history yet.
  useEffect(() => {
    if (!template) return;
    // A branch-scoped staff member's branch is locked to their own regardless of what any
    // template says (see ownBranchId above) — never let a template overwrite it back to
    // empty/a different branch.
    if (!ownBranchId) setBranchId(template.branchId || '');
    setDoctorId(template.doctorId || '');
    setServiceId(template.serviceId || '');
    setLabels({
      branch: ownBranchId ? (branchesData?.items?.find((b) => b.id === ownBranchId)?.displayName
        || branchesData?.items?.find((b) => b.id === ownBranchId)?.name || '') : (template.branch?.name || ''),
      doctor: template.doctor?.name || template.doctor?.doctorCode || '',
      service: template.service?.name || '',
    });
    // Whenever a field's value genuinely isn't known, show its picker directly instead of a
    // "Not set" label with a separate Change click to reach the exact same picker — applied the
    // same way regardless of whether the value came from real visit history or the
    // primary-record fallback (a service is never known from that fallback; a doctor can be
    // unknown too if a real history template legitimately had no doctor recorded).
    setEditing({ branch: false, doctor: !template.doctor, service: !template.service });
  }, [template]);

  // Same guard the wizard uses: any context change invalidates the held slot.
  useEffect(() => {
    setSlot(null);
  }, [branchId, doctorId, date]);

  const returning = Boolean(template);
  const firstTime = Boolean(patientId) && historyLoaded && !template;
  const canSubmit = Boolean(branchId && doctorId && serviceId && patientId && slot);

  // Never fall back to the raw ObjectId while the patient record is still loading —
  // show a loading placeholder instead of the id string.
  const patientLabel = patient
    ? `${patient.mrn} · ${patient.fullName}`
    : t('common.loading', 'Loading…');

  const patientBlock = (
    <div className="rounded-xl border bg-card p-4">
      {!patientId || changingPatient ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            {t('appointments.quick.whichPatient', 'Which patient?')}
          </p>
          <PatientPicker
            value={patientId}
            onChange={(id) => {
              setPatientId(id);
              if (id) setChangingPatient(false);
            }}
            search={patientSearch}
            onSearchChange={setPatientSearch}
            branchId={branchId}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('appointments.quick.patient', 'Patient')}
            </p>
            <p className="truncate text-sm font-medium">{patientLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {returning && (
              <Badge variant="success">
                {t('appointments.quick.returning', 'Returning')}
              </Badge>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setChangingPatient(true)}
            >
              {t('appointments.quick.change', 'Change')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {patientBlock}

      {!patientId && (
        <EmptyState
          title={t('appointments.quick.startTitle', 'Start with the patient')}
          description={t(
            'appointments.quick.startDescription',
            'Pick a patient and we will reuse their last visit — branch, doctor and service — so you only choose a time.'
          )}
        />
      )}

      {Boolean(patientId) && loadingHistory && <Skeleton className="h-40 w-full" />}

      {firstTime && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t(
              'appointments.quick.firstTimeHint',
              'First visit — no history to reuse, so pick branch, doctor, service and a slot.'
            )}
          </p>
          <BookingWizard key={patientId} initialPatientId={patientId} onCreated={onCreated} />
        </div>
      )}

      {returning && (
        <>
          <div className="divide-y rounded-xl border bg-card px-4 py-1">
            <SummaryRow
              label={t('appointments.quick.branch', 'Branch')}
              value={labels.branch || t('appointments.quick.notSet', 'Not set')}
              changeLabel={t('appointments.quick.change', 'Change')}
              isEditing={editing.branch}
              onChange={() => setEditing((e) => ({ ...e, branch: true }))}
              locked={Boolean(ownBranchId)}
            >
              <BranchPicker
                value={branchId}
                onChange={(id) => {
                  setBranchId(id);
                  // Doctor lists are branch-scoped — a stale doctor would break slots.
                  setDoctorId('');
                  setEditing((e) => ({ ...e, doctor: true }));
                }}
              />
            </SummaryRow>

            <SummaryRow
              label={t('appointments.quick.doctor', 'Doctor')}
              value={labels.doctor || t('appointments.quick.notSet', 'Not set')}
              changeLabel={t('appointments.quick.change', 'Change')}
              isEditing={editing.doctor}
              onChange={() => setEditing((e) => ({ ...e, doctor: true }))}
            >
              <DoctorPicker value={doctorId} onChange={setDoctorId} branchId={branchId} />
            </SummaryRow>

            <SummaryRow
              label={t('appointments.quick.service', 'Service')}
              value={labels.service || t('appointments.quick.notSet', 'Not set')}
              changeLabel={t('appointments.quick.change', 'Change')}
              isEditing={editing.service}
              onChange={() => setEditing((e) => ({ ...e, service: true }))}
            >
              <ServicePicker value={serviceId} onChange={setServiceId} />
            </SummaryRow>
          </div>

          <div className="space-y-3 rounded-xl border bg-card p-4">
            <p className="text-sm font-medium">
              {t('appointments.quick.pickTime', 'Pick a time')}
            </p>
            <SlotPicker
              branchId={branchId}
              doctorId={doctorId}
              date={date}
              onDateChange={setDate}
              slot={slot}
              onSlotChange={setSlot}
            />
            {showExtras ? (
              <div className="space-y-2">
                <Input
                  placeholder={t('appointments.wizard.reasonForVisit', 'Reason for visit')}
                  value={reasonForVisit}
                  onChange={(e) => setReasonForVisit(e.target.value)}
                />
                <Input
                  placeholder={t('appointments.wizard.notes', 'Notes')}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2"
                onClick={() => setShowExtras(true)}
              >
                {t('appointments.quick.addReason', '+ Add reason / notes')}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              {t(
                'appointments.wizard.revalidateHint',
                'Slot will be re-validated by the scheduling engine on submit.'
              )}
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={isPending || !canSubmit}
              onClick={() =>
                submit({
                  branchId,
                  doctorId,
                  serviceId,
                  patientId,
                  date,
                  slot,
                  reasonForVisit,
                  notes,
                })
              }
            >
              {isPending
                ? t('appointments.wizard.booking', 'Booking…')
                : t('appointments.quick.confirmBooking', 'Confirm booking')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default QuickBookingPanel;
