import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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
import { appointmentsApi } from '@/modules/appointments/api/appointmentsApi';
import { QUEUE_PRIORITY_OPTIONS } from '../constants';
import { useWalkIn } from '../hooks/useReception';

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
  const [patientSearch, setPatientSearch] = useState('');

  const patients = patientsData?.items || [];
  const doctors = doctorsData?.items || [];
  const services = servicesData || [];

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    if (!q) return patients.slice(0, 30);
    return patients.filter(
      (p) =>
        p.mrn?.toLowerCase().includes(q) ||
        p.firstName?.toLowerCase().includes(q) ||
        p.lastName?.toLowerCase().includes(q) ||
        p.mobile?.includes(q)
    );
  }, [patients, patientSearch]);

  useEffect(() => {
    if (!open || !doctorId || !branchId) {
      setSlots([]);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
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
      receptionNotes: 'Walk-in',
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
            <Input
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder={t('reception.walkIn.searchPatientPlaceholder')}
            />
            <Select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
              <option value="">{t('reception.walkIn.selectPatient')}</option>
              {filteredPatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.mrn} — {[p.firstName, p.lastName].filter(Boolean).join(' ')}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('reception.doctor')}</Label>
            <Select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
              <option value="">{t('reception.filters.selectDoctor')}</option>
              {(Array.isArray(doctors) ? doctors : []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.doctorCode} — {d.user?.fullName || d.name || t('reception.doctor')}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('reception.walkIn.service')}</Label>
            <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)} required>
              <option value="">{t('reception.walkIn.selectService')}</option>
              {(Array.isArray(services) ? services : []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
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
