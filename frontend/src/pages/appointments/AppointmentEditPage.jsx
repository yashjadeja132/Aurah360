import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useAppointmentDetail,
  useAppointmentMutations,
} from '@/modules/appointments/hooks/useAppointments';
import { appointmentDetailPath } from '@/constants/routes';

export default function AppointmentEditPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: apt, isLoading } = useAppointmentDetail(id);
  const { update } = useAppointmentMutations();
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState('NORMAL');

  useEffect(() => {
    if (!apt) return;
    setNotes(apt.notes || '');
    setReason(apt.reasonForVisit || '');
    setPriority(apt.priority || 'NORMAL');
  }, [apt]);

  if (isLoading) return <Skeleton className="h-60 w-full" />;
  if (!apt) return <p className="text-destructive">{t('appointments.edit.notFound', 'Not found')}</p>;

  return (
    <section className="mx-auto max-w-lg space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to={appointmentDetailPath(id)}>← {apt.appointmentNumber}</Link>
        </Button>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('appointments.edit.title', 'Edit appointment')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('appointments.edit.subtitle', 'Slot changes should use Reschedule (validates via scheduling engine).')}
        </p>
      </div>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await update.mutateAsync({
              id,
              payload: { notes, reasonForVisit: reason, priority },
            });
            toast.success(t('appointments.edit.toastUpdated', 'Updated'));
            navigate(appointmentDetailPath(id));
          } catch (err) {
            toast.error(err?.response?.data?.message || t('appointments.edit.updateFailed', 'Update failed'));
          }
        }}
      >
        <div className="space-y-1.5">
          <Label>{t('appointments.edit.reasonForVisit', 'Reason for visit')}</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('appointments.edit.notes', 'Notes')}</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('appointments.edit.priority', 'Priority')}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="NORMAL">{t('appointments.edit.priorityNormal', 'Normal')}</option>
            <option value="HIGH">{t('appointments.edit.priorityHigh', 'High')}</option>
            <option value="URGENT">{t('appointments.edit.priorityUrgent', 'Urgent')}</option>
          </select>
        </div>
        <Button type="submit" disabled={update.isPending}>{t('common.save', 'Save')}</Button>
      </form>
    </section>
  );
}
