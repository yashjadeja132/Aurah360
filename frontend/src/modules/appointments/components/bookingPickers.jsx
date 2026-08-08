import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useMasterActive } from '@/modules/masters/hooks/useMasters';
import { usePatientList } from '@/modules/patients/hooks/usePatients';
import { useAvailableAppointmentSlots } from '../hooks/useAppointments';
import { cn } from '@/utils/cn';

/**
 * Shared booking pickers. These are the single source of truth for every
 * branch / doctor / service / slot / patient control in the booking flow —
 * both the guided BookingWizard (first-time patients) and the one-screen
 * QuickBookingPanel (returning patients) render these, so neither owns a
 * private copy of the option lists or the slot grid.
 */

export function BranchPicker({ value, onChange }) {
  const { t } = useTranslation();
  const { data: branchesData } = useBranchList({ limit: 50 });
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('appointments.wizard.selectBranch', 'Select branch')}</option>
      {(branchesData?.items || []).map((b) => (
        <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
      ))}
    </Select>
  );
}

export function DoctorPicker({ value, onChange, branchId = '' }) {
  const { t } = useTranslation();
  const { data: doctorsData } = useDoctorList({
    limit: 50,
    isActive: 'true',
    ...(branchId ? { branchId } : {}),
  });
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('appointments.wizard.selectDoctor', 'Select doctor')}</option>
      {(doctorsData?.items || []).map((d) => (
        <option key={d.id} value={d.id}>
          {d.user?.fullName || d.doctorCode} ({d.doctorCode})
        </option>
      ))}
    </Select>
  );
}

export function ServicePicker({ value, onChange }) {
  const { t } = useTranslation();
  const { data: services = [] } = useMasterActive('services');
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('appointments.wizard.selectService', 'Select service')}</option>
      {services.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
    </Select>
  );
}

export function PatientPicker({ value, onChange, search, onSearchChange }) {
  const { t } = useTranslation();
  const { data: patientsData } = usePatientList({ search, limit: 10, page: 1 });
  return (
    <div className="space-y-3">
      <Input
        placeholder={t('appointments.wizard.searchPatient', 'Search patient MRN / name / phone')}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('appointments.wizard.selectPatient', 'Select patient')}</option>
        {(patientsData?.items || []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.mrn} · {p.fullName} · {p.mobile}
          </option>
        ))}
      </Select>
    </div>
  );
}

/**
 * Date + slot grid. Always sourced from `useAvailableAppointmentSlots`
 * (GET /appointments/available-slots) so the chosen slot is one the
 * scheduling engine produced, and it is re-validated again on submit.
 */
export function SlotPicker({
  branchId,
  doctorId,
  date,
  onDateChange,
  slot,
  onSlotChange,
  enabled = true,
}) {
  const { t } = useTranslation();
  const slotParams = useMemo(() => ({ doctorId, date, branchId }), [doctorId, date, branchId]);
  const { data: availability, isFetching: loadingSlots } = useAvailableAppointmentSlots(
    slotParams,
    enabled && Boolean(doctorId && branchId && date)
  );

  return (
    <div className="space-y-3">
      <Input type="date" value={date} onChange={(e) => onDateChange(e.target.value)} />
      {loadingSlots ? (
        <Skeleton className="h-24 w-full" />
      ) : !availability?.available ? (
        <p className="text-sm text-muted-foreground">
          {t('appointments.wizard.noSlots', 'No slots — {{reason}}', {
            reason: availability?.reason || t('appointments.wizard.unavailable', 'unavailable'),
          })}
        </p>
      ) : (
        <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
          {availability.slots.map((s) => (
            <button
              key={`${s.start}-${s.end}`}
              type="button"
              onClick={() => onSlotChange(s)}
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
  );
}
