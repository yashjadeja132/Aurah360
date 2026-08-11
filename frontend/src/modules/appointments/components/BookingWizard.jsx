import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/constants/rbac';
import { usePatientDetail } from '@/modules/patients/hooks/usePatients';
import { useBookingSubmit } from '../hooks/useBookingSubmit';
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

// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES — every other role is pinned
// to their own single assigned branch (req.auth.branch server-side).
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];

// Mirrors backend/src/enums/appointment.js#APPOINTMENT_TYPE.
const APPOINTMENT_TYPE_OPTIONS = [
  { value: 'CONSULTATION', label: 'Consultation' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'PROCEDURE', label: 'Procedure' },
  { value: 'TREATMENT', label: 'Treatment' },
  { value: 'OTHER', label: 'Other' },
];

export function BookingWizard({ onCreated, initialPatientId = '' }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const STEP_KEYS = ['branch', 'doctor', 'service', 'slot', 'patient', 'confirm'];
  const STEP_LABELS = {
    branch: t('appointments.wizard.stepBranch', 'Branch'),
    doctor: t('appointments.wizard.stepDoctor', 'Doctor'),
    service: t('appointments.wizard.stepService', 'Service'),
    slot: t('appointments.wizard.stepSlot', 'Slot'),
    patient: t('appointments.wizard.stepPatient', 'Patient'),
    confirm: t('appointments.wizard.stepConfirm', 'Confirm'),
  };

  // A branch-scoped staff member (everyone except Owner/Admin) already has exactly one branch
  // they work from — asking them to pick it every time they book is the same "make them choose
  // something the system already knows" friction as the doctor/patient over-asking fixed
  // elsewhere this session. Pre-fill it and skip the step entirely; Owner/Admin still choose,
  // since they genuinely work across branches.
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const ownBranchId = !isGlobalScope ? user?.branch || '' : '';
  const skipBranchStep = Boolean(ownBranchId);
  // Pre-filled patient (e.g. recall worklist "Booked" hand-off) auto-satisfies the patient step.
  const skipPatientStep = Boolean(initialPatientId);

  const visibleSteps = useMemo(
    () =>
      STEP_KEYS.filter(
        (key) => !((key === 'branch' && skipBranchStep) || (key === 'patient' && skipPatientStep))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [skipBranchStep, skipPatientStep]
  );

  const [visibleIndex, setVisibleIndex] = useState(0);
  const currentKey = visibleSteps[visibleIndex];

  const [branchId, setBranchId] = useState(ownBranchId);
  const [doctorId, setDoctorId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [appointmentType, setAppointmentType] = useState('CONSULTATION');
  const [date, setDate] = useState(todayKey());
  const [slot, setSlot] = useState(null);
  const [patientId, setPatientId] = useState(initialPatientId);
  const [patientSearch, setPatientSearch] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [notes, setNotes] = useState('');

  const { submit, isPending } = useBookingSubmit(onCreated);
  const { data: prefilledPatient } = usePatientDetail(initialPatientId || undefined);
  const goNext = () => setVisibleIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
  const goBack = () => setVisibleIndex((i) => Math.max(i - 1, 0));

  useEffect(() => {
    setSlot(null);
  }, [doctorId, date, branchId]);

  const canNext = () => {
    if (currentKey === 'branch') return Boolean(branchId);
    if (currentKey === 'doctor') return Boolean(doctorId);
    if (currentKey === 'service') return Boolean(serviceId);
    if (currentKey === 'slot') return Boolean(slot);
    if (currentKey === 'patient') return Boolean(patientId);
    return true;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {visibleSteps.map((key, i) => (
          <Badge key={key} variant={i === visibleIndex ? 'default' : i < visibleIndex ? 'success' : 'secondary'}>
            {i + 1}. {STEP_LABELS[key]}
          </Badge>
        ))}
      </div>

      {skipBranchStep && (
        <p className="text-sm text-muted-foreground">
          {t('appointments.wizard.prefilledBranch', 'Booking at your branch — branch step pre-filled.')}
        </p>
      )}
      {skipPatientStep && (
        <p className="text-sm text-muted-foreground">
          {t('appointments.wizard.prefilledPatient', 'Booking for {{patient}} — patient step pre-filled.', {
            patient: prefilledPatient
              ? `${prefilledPatient.mrn} · ${prefilledPatient.fullName}`
              : t('appointments.wizard.selectedPatient', 'selected patient'),
          })}
        </p>
      )}

      {currentKey === 'branch' && <BranchPicker value={branchId} onChange={setBranchId} />}

      {currentKey === 'doctor' && (
        <DoctorPicker value={doctorId} onChange={setDoctorId} branchId={branchId} />
      )}

      {currentKey === 'service' && (
        <div className="space-y-4">
          <ServicePicker value={serviceId} onChange={setServiceId} />
          <div className="space-y-2">
            <Label>{t('appointments.wizard.appointmentType', 'Appointment type')}</Label>
            <Select value={appointmentType} onChange={(e) => setAppointmentType(e.target.value)}>
              {APPOINTMENT_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(`appointments.type.${o.value}`, o.label)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      )}

      {currentKey === 'slot' && (
        <SlotPicker
          branchId={branchId}
          doctorId={doctorId}
          date={date}
          onDateChange={setDate}
          slot={slot}
          onSlotChange={setSlot}
        />
      )}

      {currentKey === 'patient' && (
        <PatientPicker
          value={patientId}
          onChange={setPatientId}
          search={patientSearch}
          onSearchChange={setPatientSearch}
          branchId={branchId}
        />
      )}

      {currentKey === 'confirm' && (
        <div className="space-y-3 rounded-xl border bg-card p-4 text-sm">
          <p><span className="text-muted-foreground">{t('appointments.wizard.date', 'Date:')}</span> {date} {slot?.start}–{slot?.end}</p>
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
          <p className="text-xs text-muted-foreground">
            {t('appointments.wizard.revalidateHint', 'Slot will be re-validated by the scheduling engine on submit.')}
          </p>
        </div>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" disabled={visibleIndex === 0} onClick={goBack}>
          {t('common.back', 'Back')}
        </Button>
        {visibleIndex < visibleSteps.length - 1 ? (
          <Button type="button" disabled={!canNext()} onClick={goNext}>
            {t('common.next', 'Next')}
          </Button>
        ) : (
          <Button
            type="button"
            disabled={isPending || !canNext()}
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
                appointmentType,
                // Guided wizard is used from the front desk's "Book" and "Book appointment"
                // shortcuts — a receptionist scheduling ahead, not a walk-in — so `PHONE` best
                // matches "booked at/by the desk, not a literal walk-in, not self-service online".
                source: 'PHONE',
              })
            }
          >
            {isPending ? t('appointments.wizard.booking', 'Booking…') : t('appointments.wizard.createAppointment', 'Create appointment')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default BookingWizard;
