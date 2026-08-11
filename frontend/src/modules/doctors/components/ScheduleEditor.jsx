import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useDoctorSchedules, useDoctorMutations } from '../hooks/useDoctors';
import { RosterImpactPanel } from './RosterImpactPanel';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptyWeek = () =>
  DAY_LABELS.map((_, dayOfWeek) => ({
    dayOfWeek,
    isWorking: dayOfWeek !== 0,
    startTime: '10:00',
    endTime: '19:00',
    lunchStart: '13:00',
    lunchEnd: '14:00',
    slotDuration: 15,
    bufferTime: 5,
    maximumAppointments: 40,
  }));

export function ScheduleEditor({ doctorId, branches = [] }) {
  const { t } = useTranslation();
  const DAY_LABEL_KEYS = [
    t('doctors.scheduleEditor.sun', 'Sun'),
    t('doctors.scheduleEditor.mon', 'Mon'),
    t('doctors.scheduleEditor.tue', 'Tue'),
    t('doctors.scheduleEditor.wed', 'Wed'),
    t('doctors.scheduleEditor.thu', 'Thu'),
    t('doctors.scheduleEditor.fri', 'Fri'),
    t('doctors.scheduleEditor.sat', 'Sat'),
  ];
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const { data: schedules = [], isLoading } = useDoctorSchedules(doctorId, branchId);
  const { upsertSchedules } = useDoctorMutations();
  const [days, setDays] = useState(emptyWeek());
  const [impactedAppointments, setImpactedAppointments] = useState([]);

  useEffect(() => {
    if (!branches.length) return;
    if (!branchId) setBranchId(branches[0].id);
  }, [branches, branchId]);

  useEffect(() => {
    const base = emptyWeek();
    schedules.forEach((row) => {
      base[row.dayOfWeek] = {
        dayOfWeek: row.dayOfWeek,
        isWorking: row.isWorking,
        startTime: row.startTime,
        endTime: row.endTime,
        lunchStart: row.lunchStart || '13:00',
        lunchEnd: row.lunchEnd || '14:00',
        slotDuration: row.slotDuration,
        bufferTime: row.bufferTime,
        maximumAppointments: row.maximumAppointments,
      };
    });
    setDays(base);
  }, [schedules]);

  const updateDay = (index, patch) => {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const onSave = async (overrideReason = null) => {
    if (!branchId) {
      toast.error(t('doctors.scheduleEditor.selectBranch', 'Select a branch'));
      return;
    }
    try {
      const payload = { branchId, days };
      if (overrideReason) {
        payload.acknowledgeOverride = true;
        payload.overrideReason = overrideReason;
      }
      const result = await upsertSchedules.mutateAsync({ id: doctorId, payload });
      setImpactedAppointments([]);
      if (result?.overridden) {
        toast.success(t('doctors.scheduleEditor.toastSavedWithOverride', 'Schedule saved (override recorded)'));
      } else {
        toast.success(t('doctors.scheduleEditor.toastSaved', 'Schedule saved'));
      }
    } catch (err) {
      const impacted = err.response?.data?.errors?.impactedAppointments;
      if (err.response?.status === 409 && Array.isArray(impacted) && impacted.length) {
        setImpactedAppointments(impacted);
        return;
      }
      toast.error(err.response?.data?.message || t('doctors.scheduleEditor.saveFailed', 'Save failed'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="max-w-xs space-y-2">
        <Label>{t('doctors.scheduleEditor.branch', 'Branch')}</Label>
        <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('doctors.scheduleEditor.loading', 'Loading schedule…')}</p>
      ) : (
        <div className="space-y-3">
          {days.map((day, index) => (
            <div key={day.dayOfWeek} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[80px_1fr]">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={day.isWorking}
                  onChange={(e) => updateDay(index, { isWorking: e.target.checked })}
                />
                <span className="text-sm font-medium">{DAY_LABEL_KEYS[day.dayOfWeek]}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <Input type="time" value={day.startTime} disabled={!day.isWorking} onChange={(e) => updateDay(index, { startTime: e.target.value })} />
                <Input type="time" value={day.endTime} disabled={!day.isWorking} onChange={(e) => updateDay(index, { endTime: e.target.value })} />
                <Input type="time" value={day.lunchStart} disabled={!day.isWorking} onChange={(e) => updateDay(index, { lunchStart: e.target.value })} />
                <Input type="time" value={day.lunchEnd} disabled={!day.isWorking} onChange={(e) => updateDay(index, { lunchEnd: e.target.value })} />
                <Input type="number" value={day.slotDuration} disabled={!day.isWorking} onChange={(e) => updateDay(index, { slotDuration: Number(e.target.value) })} placeholder={t('doctors.scheduleEditor.slot', 'Slot')} />
                <Input type="number" value={day.bufferTime} disabled={!day.isWorking} onChange={(e) => updateDay(index, { bufferTime: Number(e.target.value) })} placeholder={t('doctors.scheduleEditor.buffer', 'Buffer')} />
              </div>
            </div>
          ))}
        </div>
      )}

      {impactedAppointments.length > 0 && (
        <RosterImpactPanel
          impactedAppointments={impactedAppointments}
          isSubmitting={upsertSchedules.isPending}
          onOverride={(reason) => onSave(reason)}
          onCancel={() => setImpactedAppointments([])}
        />
      )}

      <Button onClick={() => onSave()} disabled={upsertSchedules.isPending}>
        {upsertSchedules.isPending ? t('doctors.scheduleEditor.saving', 'Saving…') : t('doctors.scheduleEditor.saveWeeklySchedule', 'Save weekly schedule')}
      </Button>
    </div>
  );
}

export default ScheduleEditor;
