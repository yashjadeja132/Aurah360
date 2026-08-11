import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SearchableCombobox } from '@/components/common/SearchableCombobox';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useMasterActive } from '@/modules/masters/hooks/useMasters';
import { usePatientList } from '@/modules/patients/hooks/usePatients';
import { QuickAddPatientDialog } from '@/modules/patients/components/QuickAddPatientDialog';
import { useAvailableAppointmentSlots } from '../hooks/useAppointments';
import { cn } from '@/utils/cn';

/**
 * Shared booking pickers. These are the single source of truth for every
 * branch / doctor / service / slot / patient control in the booking flow —
 * both the guided BookingWizard (first-time patients) and the one-screen
 * QuickBookingPanel (returning patients) render these, so neither owns a
 * private copy of the option lists or the slot grid.
 *
 * Every list picker here is a single search-and-select field (SearchableCombobox), not a
 * separate search box sitting above a native `<select>` — typing filters AND selects in the
 * same control, matching the pattern MedicineSearchInput already used successfully.
 */

export function BranchPicker({ value, onChange }) {
  const { t } = useTranslation();
  const { data: branchesData } = useBranchList({ limit: 50 });
  return (
    <SearchableCombobox
      value={value}
      onChange={onChange}
      options={branchesData?.items || []}
      filterKeys={['displayName', 'name']}
      renderLabel={(b) => b.displayName || b.name}
      placeholder={t('appointments.wizard.selectBranch', 'Select branch')}
      emptyText={t('appointments.wizard.noBranchMatch', 'No branch matches')}
    />
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
    <SearchableCombobox
      value={value}
      onChange={onChange}
      options={doctorsData?.items || []}
      filterKeys={['doctorCode']}
      renderLabel={(d) => d.user?.fullName || d.doctorCode}
      renderSublabel={(d) => `(${d.doctorCode})`}
      placeholder={t('appointments.wizard.selectDoctor', 'Select doctor')}
      emptyText={t('appointments.wizard.noDoctorMatch', 'No doctor matches')}
    />
  );
}

export function ServicePicker({ value, onChange }) {
  const { t } = useTranslation();
  const { data: services = [] } = useMasterActive('services');
  return (
    <SearchableCombobox
      value={value}
      onChange={onChange}
      options={services}
      filterKeys={['name']}
      renderLabel={(s) => s.name}
      placeholder={t('appointments.wizard.selectService', 'Select service')}
      emptyText={t('appointments.wizard.noServiceMatch', 'No service matches')}
    />
  );
}

export function PatientPicker({ value, onChange, search, onSearchChange, branchId = '' }) {
  const { t } = useTranslation();
  const { data: patientsData, isFetching } = usePatientList({ search, limit: 10, page: 1 });
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [pendingName, setPendingName] = useState('');
  const patients = patientsData?.items || [];

  return (
    <div className="space-y-1">
      <SearchableCombobox
        value={value}
        onChange={onChange}
        options={patients}
        search={search}
        onSearchChange={onSearchChange}
        isLoading={isFetching}
        loadingText={t('common.searching', 'Searching…')}
        renderLabel={(p) => `${p.mrn} · ${p.fullName}`}
        renderSublabel={(p) => p.mobile}
        placeholder={t('appointments.wizard.searchPatient', 'Search patient MRN / name / phone')}
        emptyText={t('appointments.wizard.noPatientMatch', 'No match')}
        onAddNew={(typed) => {
          setPendingName(typed);
          setQuickAddOpen(true);
        }}
        addNewLabel={t('appointments.wizard.addNewPatient', 'Add new patient')}
      />
      <QuickAddPatientDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        defaultBranchId={branchId}
        defaultName={pendingName}
        onCreated={(patient) => onChange(patient.id)}
      />
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
