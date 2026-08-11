import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { SearchableCombobox } from '@/components/common/SearchableCombobox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { usePatientList } from '@/modules/patients/hooks/usePatients';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useMasterActive } from '@/modules/masters/hooks/useMasters';
import { QuickAddPatientDialog } from '@/modules/patients/components/QuickAddPatientDialog';
import { appointmentsApi } from '@/modules/appointments/api/appointmentsApi';
import { QUEUE_PRIORITY_OPTIONS } from '../constants';
import { useWalkIn } from '../hooks/useReception';
// 'Today' must come from the LOCAL calendar day: a UTC slice returns YESTERDAY between 00:00
// and 05:30 IST, so a view opened before dawn silently loaded the wrong day. See '@/utils/date'.
import { todayKey } from '@/utils/date';

export function WalkInDialog({ open, onOpenChange, branchId }) {
  const { t } = useTranslation();
  const walkIn = useWalkIn();
  const { data: patientsData } = usePatientList({ limit: 50 });
  const { data: doctorsData } = useDoctorList({ limit: 50 });
  const { data: servicesData } = useMasterActive('services');

  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [slots, setSlots] = useState([]);
  const [queuePriority, setQueuePriority] = useState('NORMAL');
  const [handoffNote, setHandoffNote] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const patients = patientsData?.items || [];
  const doctors = doctorsData?.items || [];
  const services = servicesData || [];
  const [pendingName, setPendingName] = useState('');

  useEffect(() => {
    if (!open || !doctorId || !branchId) {
      setSlots([]);
      return;
    }
    const today = todayKey();
    appointmentsApi
      .availableSlots({ doctorId, branchId, date: today })
      .then((res) => {
        const list = res?.data?.slots || [];
        setSlots(list);
        if (list[0]) {
          setStartTime(list[0].start);
          setEndTime(list[0].end);
        }
      })
      .catch(() => setSlots([]));
  }, [open, doctorId, branchId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await walkIn.mutateAsync({
      patientId,
      doctorId,
      branchId,
      serviceId,
      appointmentDate: new Date().toISOString(),
      startTime,
      endTime,
      queuePriority,
      // Optional per spec §2 — leave genuinely blank rather than substituting a fake note;
      // the backend records `source: 'WALK_IN'` on the appointment itself for that distinction.
      receptionNotes: handoffNote.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('reception.walkIn.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('reception.walkIn.dialogDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label>{t('reception.walkIn.searchPatient')}</Label>
            <SearchableCombobox
              value={patientId}
              onChange={setPatientId}
              options={patients}
              filterKeys={['mrn', 'firstName', 'lastName', 'mobile']}
              renderLabel={(p) => `${p.mrn} — ${[p.firstName, p.lastName].filter(Boolean).join(' ')}`}
              renderSublabel={(p) => p.mobile}
              placeholder={t('reception.walkIn.searchPatientPlaceholder')}
              emptyText={t('appointments.wizard.noPatientMatch', 'No match')}
              onAddNew={(typed) => {
                setPendingName(typed);
                setQuickAddOpen(true);
              }}
              addNewLabel={t('appointments.wizard.addNewPatient', 'Add new patient')}
            />
          </div>
          <QuickAddPatientDialog
            open={quickAddOpen}
            onOpenChange={setQuickAddOpen}
            defaultBranchId={branchId}
            defaultName={pendingName}
            onCreated={(patient) => setPatientId(patient.id)}
          />

          <div className="space-y-2">
            <Label>{t('reception.doctor')}</Label>
            <SearchableCombobox
              value={doctorId}
              onChange={setDoctorId}
              options={Array.isArray(doctors) ? doctors : []}
              filterKeys={['doctorCode']}
              renderLabel={(d) => d.user?.fullName || d.name || t('reception.doctor')}
              renderSublabel={(d) => `(${d.doctorCode})`}
              placeholder={t('reception.filters.selectDoctor')}
              emptyText={t('appointments.wizard.noDoctorMatch', 'No doctor matches')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('reception.walkIn.service')}</Label>
            <SearchableCombobox
              value={serviceId}
              onChange={setServiceId}
              options={Array.isArray(services) ? services : []}
              filterKeys={['name']}
              renderLabel={(s) => s.name}
              placeholder={t('reception.walkIn.selectService')}
              emptyText={t('appointments.wizard.noServiceMatch', 'No service matches')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('reception.walkIn.availableSlot')}</Label>
            <Select
              value={startTime && endTime ? `${startTime}|${endTime}` : ''}
              onChange={(e) => {
                const [s, en] = e.target.value.split('|');
                setStartTime(s);
                setEndTime(en);
              }}
              required
            >
              <option value="">{t('reception.walkIn.selectSlot')}</option>
              {slots.map((s) => (
                <option key={`${s.start}-${s.end}`} value={`${s.start}|${s.end}`}>
                  {s.start} – {s.end}
                </option>
              ))}
            </Select>
            {!slots.length && doctorId && (
              <p className="text-xs text-amber-700">{t('reception.walkIn.noOpenSlots')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t('reception.checkIn.queuePriority')}</Label>
            <Select value={queuePriority} onChange={(e) => setQueuePriority(e.target.value)}>
              {QUEUE_PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(`reception.priority.${o.value}`, o.label)}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('reception.walkIn.handoffNote', 'Handoff note (optional)')}</Label>
            <Input
              value={handoffNote}
              onChange={(e) => setHandoffNote(e.target.value)}
              placeholder={t('reception.checkIn.optionalNotes')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={walkIn.isPending || !slots.length}>
              {walkIn.isPending ? t('reception.walkIn.registering') : t('reception.walkIn.register')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
