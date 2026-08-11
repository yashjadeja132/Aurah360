import { useState } from 'react';
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
import { QUEUE_PRIORITY_OPTIONS } from '../constants';
import { useCheckIn } from '../hooks/useReception';
import { IntakeStep } from './IntakeStep';

export function CheckInDialog({ open, onOpenChange, appointment }) {
  const { t } = useTranslation();
  const checkIn = useCheckIn();
  const [priority, setPriority] = useState('NORMAL');
  const [receptionNotes, setReceptionNotes] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [mobile, setMobile] = useState(appointment?.patient?.mobile || '');
  const [privacyPolicy, setPrivacyPolicy] = useState(false);
  const [treatmentConsent, setTreatmentConsent] = useState(false);
  // Step 2 (intake: photos + fee + send to doctor) opens right after a successful check-in.
  const [intake, setIntake] = useState(null);

  if (!appointment) return null;

  const late = appointment.isLate;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await checkIn.mutateAsync({
      appointmentId: appointment.id,
      payload: {
        priority,
        receptionNotes: receptionNotes || null,
        symptoms: symptoms || null,
        updateContact: mobile ? { mobile } : undefined,
        consent: {
          privacyPolicy: privacyPolicy || undefined,
          treatmentConsent: treatmentConsent || undefined,
        },
      },
    });
    const d = res?.data || {};
    setIntake({
      appointmentId: appointment.id,
      consultationId: d.consultationId || null,
      patientId: d.queueEntry?.patientId || appointment.patientId || appointment.patient?.id,
      branchId: d.queueEntry?.branchId || appointment.branchId,
      tokenNumber: d.queueEntry?.tokenNumber || null,
    });
  };

  const close = () => {
    setIntake(null);
    onOpenChange(false);
  };

  if (intake) {
    return (
      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reception.intake.title', 'Intake — photos & fee')}</DialogTitle>
            <DialogDescription>
              {appointment.patient?.fullName} · {appointment.appointmentNumber}
            </DialogDescription>
          </DialogHeader>
          <IntakeStep intake={intake} onDone={close} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('reception.checkIn.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {appointment.patient?.fullName} · {appointment.appointmentNumber} ·{' '}
            {appointment.startTime}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {late && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t('reception.checkIn.lateArrival', { time: appointment.startTime })}
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('reception.checkIn.queuePriority')}</Label>
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {QUEUE_PRIORITY_OPTIONS
                .filter((o) => o.value !== 'PREGNANT' || appointment.patient?.gender === 'FEMALE')
                .map((o) => (
                <option key={o.value} value={o.value}>
                  {t(`reception.priority.${o.value}`, o.label)}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('reception.checkIn.updateMobile')}</Label>
            <Input value={mobile} onChange={(e) => setMobile(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t('reception.checkIn.symptoms', 'Symptoms / complaint')}</Label>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder={t(
                'reception.checkIn.symptomsPlaceholder',
                'e.g. itching and red patches on the forearm for 2 weeks, mild burning'
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('reception.checkIn.receptionNotes')}</Label>
            <Input
              value={receptionNotes}
              onChange={(e) => setReceptionNotes(e.target.value)}
              placeholder={t('reception.checkIn.optionalNotes')}
            />
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={privacyPolicy}
                onChange={(e) => setPrivacyPolicy(e.target.checked)}
              />
              {t('reception.checkIn.privacyConsent')}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={treatmentConsent}
                onChange={(e) => setTreatmentConsent(e.target.checked)}
              />
              {t('reception.checkIn.treatmentConsent')}
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={checkIn.isPending}>
              {checkIn.isPending ? t('reception.checkIn.checkingIn') : t('reception.checkIn.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
