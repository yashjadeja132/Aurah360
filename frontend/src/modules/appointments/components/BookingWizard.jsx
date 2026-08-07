import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useMasterActive } from '@/modules/masters/hooks/useMasters';
import { usePatientList } from '@/modules/patients/hooks/usePatients';
import {
  useAvailableAppointmentSlots,
  useAppointmentMutations,
} from '../hooks/useAppointments';
import { cn } from '@/utils/cn';

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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [slot, setSlot] = useState(null);
  const [patientId, setPatientId] = useState(initialPatientId);
  const [patientSearch, setPatientSearch] = useState('');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [notes, setNotes] = useState('');

  const { data: branchesData } = useBranchList({ limit: 50 });
  const { data: doctorsData } = useDoctorList({
    limit: 50,
    isActive: 'true',
    ...(branchId ? { branchId } : {}),
  });
  const { data: services = [] } = useMasterActive('services');
  const { data: patientsData } = usePatientList({
    search: patientSearch,
    limit: 10,
    page: 1,
  });
  const slotParams = useMemo(
    () => ({ doctorId, date, branchId }),
    [doctorId, date, branchId]
  );
  const { data: availability, isFetching: loadingSlots } = useAvailableAppointmentSlots(
    slotParams,
    step >= 3 && Boolean(doctorId && branchId && date)
  );
  const { create } = useAppointmentMutations();

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

  const submit = async () => {
    try {
      const res = await create.mutateAsync({
        branchId,
        doctorId,
        serviceId,
        patientId,
        appointmentDate: date,
        startTime: slot.start,
        endTime: slot.end,
        reasonForVisit: reasonForVisit || null,
        notes: notes || null,
        source: 'WALK_IN',
        appointmentType: 'CONSULTATION',
      });
      toast.success(t('appointments.wizard.toastBooked', 'Booked {{number}}', { number: res.data.appointment.appointmentNumber }));
      onCreated?.(res.data.appointment);
    } catch (err) {
      toast.error(err?.response?.data?.message || t('appointments.wizard.bookingFailed', 'Booking failed — slot may be unavailable'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <Badge
            key={label}
            variant={i === step ? 'default' : i < step ? 'success' : 'secondary'}
          >
            {i + 1}. {label}
          </Badge>
        ))}
      </div>

      {step === 0 && (
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">{t('appointments.wizard.selectBranch', 'Select branch')}</option>
          {(branchesData?.items || []).map((b) => (
            <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
          ))}
        </Select>
      )}

      {step === 1 && (
        <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">{t('appointments.wizard.selectDoctor', 'Select doctor')}</option>
          {(doctorsData?.items || []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.user?.fullName || d.doctorCode} ({d.doctorCode})
            </option>
          ))}
        </Select>
      )}

      {step === 2 && (
        <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">{t('appointments.wizard.selectService', 'Select service')}</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {loadingSlots ? (
            <Skeleton className="h-24 w-full" />
          ) : !availability?.available ? (
            <p className="text-sm text-muted-foreground">
              {t('appointments.wizard.noSlots', 'No slots — {{reason}}', { reason: availability?.reason || t('appointments.wizard.unavailable', 'unavailable') })}
            </p>
          ) : (
            <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
              {availability.slots.map((s) => (
                <button
                  key={`${s.start}-${s.end}`}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 font-mono text-xs',
                    slot?.start === s.start
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-secondary'
                  )}
                >
                  {s.start}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <Input
            placeholder={t('appointments.wizard.searchPatient', 'Search patient MRN / name / phone')}
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
          />
          <Select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">{t('appointments.wizard.selectPatient', 'Select patient')}</option>
            {(patientsData?.items || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.mrn} · {p.fullName} · {p.mobile}
              </option>
            ))}
          </Select>
        </div>
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
          onClick={() => setStep((s) => s - 1)}
        >
          {t('common.back', 'Back')}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>
            {t('common.next', 'Next')}
          </Button>
        ) : (
          <Button type="button" disabled={create.isPending || !canNext()} onClick={submit}>
            {create.isPending ? t('appointments.wizard.booking', 'Booking…') : t('appointments.wizard.createAppointment', 'Create appointment')}
          </Button>
        )}
      </div>
    </div>
  );
}

export default BookingWizard;
