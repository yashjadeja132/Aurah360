import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

export function BookingWizard({ onCreated, initialPatientId = '' }) {
  const { t } = useTranslation();
  const STEPS = [
    t('appointments.wizard.stepBranch', 'Branch'),
    t('appointments.wizard.stepDoctor', 'Doctor'),
    t('appointments.wizard.stepService', 'Service'),
    t('appointments.wizard.stepSlot', 'Slot'),
    t('appointments.wizard.stepPatient', 'Patient'),
    t('appointments.wizard.stepConfirm', 'Confirm'),
  ];
  const [step, setStep] = useState(0);
  const [branchId, setBranchId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(todayKey());
  const [slot, setSlot] = useState(null);
  const [patientId, setPatientId] = useState(initialPatientId);
  const [patientSearch, setPatientSearch] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [notes, setNotes] = useState('');

  const { submit, isPending } = useBookingSubmit(onCreated);
  // Pre-filled patient (e.g. recall worklist "Booked" hand-off) auto-satisfies the patient step.
  const skipPatientStep = Boolean(initialPatientId);
  const PATIENT_STEP = 4;
  const { data: prefilledPatient } = usePatientDetail(initialPatientId || undefined);
  const goNext = () =>
    setStep((s) => (skipPatientStep && s === PATIENT_STEP - 1 ? s + 2 : s + 1));
  const goBack = () =>
    setStep((s) => (skipPatientStep && s === PATIENT_STEP + 1 ? s - 2 : s - 1));

  useEffect(() => {
    setSlot(null);
  }, [doctorId, date, branchId]);

  const canNext = () => {
    if (step === 0) return Boolean(branchId);
    if (step === 1) return Boolean(doctorId);
    if (step === 2) return Boolean(serviceId);
    if (step === 3) return Boolean(slot);
    if (step === 4) return Boolean(patientId);
    return true;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <Badge
            key={label}
            variant={
              i === step
                ? 'default'
                : i < step || (skipPatientStep && i === PATIENT_STEP)
                  ? 'success'
                  : 'secondary'
            }
          >
            {i + 1}. {label}
          </Badge>
        ))}
      </div>

      {skipPatientStep && (
        <p className="text-sm text-muted-foreground">
          {t('appointments.wizard.prefilledPatient', 'Booking for {{patient}} — patient step pre-filled.', {
            patient: prefilledPatient
              ? `${prefilledPatient.mrn} · ${prefilledPatient.fullName}`
              : t('appointments.wizard.selectedPatient', 'selected patient'),
          })}
        </p>
      )}

      {step === 0 && <BranchPicker value={branchId} onChange={setBranchId} />}

      {step === 1 && (
        <DoctorPicker value={doctorId} onChange={setDoctorId} branchId={branchId} />
      )}

      {step === 2 && <ServicePicker value={serviceId} onChange={setServiceId} />}

      {step === 3 && (
        <SlotPicker
          branchId={branchId}
          doctorId={doctorId}
          date={date}
          onDateChange={setDate}
          slot={slot}
          onSlotChange={setSlot}
        />
      )}

      {step === 4 && (
        <PatientPicker
          value={patientId}
          onChange={setPatientId}
          search={patientSearch}
          onSearchChange={setPatientSearch}
        />
      )}

      {step === 5 && (
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
        <Button
          type="button"
          variant="outline"
          disabled={step === 0}
          onClick={goBack}
        >
          {t('common.back', 'Back')}
        </Button>
        {step < STEPS.length - 1 ? (
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
