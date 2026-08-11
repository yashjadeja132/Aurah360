import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import {
  useAppointmentDetail,
  useAppointmentMutations,
  useAvailableAppointmentSlots,
} from '@/modules/appointments/hooks/useAppointments';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_VARIANT,
  CANCELLATION_REASON_LABELS,
  CANCELLATION_REASON_OPTIONS,
} from '@/modules/appointments/constants';
import {
  APP_ROUTES,
  appointmentEditPath,
  patientDetailPath,
} from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

export default function AppointmentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: apt, isLoading, isError } = useAppointmentDetail(id);
  const { confirm, cancel, noShow, complete, reschedule, followUp, remove } =
    useAppointmentMutations();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rsDate, setRsDate] = useState('');
  const [rsSlot, setRsSlot] = useState(null);
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [noShowReason, setNoShowReason] = useState('');
  const [noShowRecall, setNoShowRecall] = useState(false);

  const { data: slotsData } = useAvailableAppointmentSlots(
    {
      doctorId: apt?.doctorId,
      date: rsDate,
      branchId: apt?.branchId,
    },
    rescheduleOpen && Boolean(apt && rsDate)
  );

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !apt) return <p className="text-destructive">{t('appointments.detail.notFound', 'Appointment not found.')}</p>;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to={APP_ROUTES.APPOINTMENTS}>← {t('appointments.title', 'Appointments')}</Link>
          </Button>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {apt.appointmentNumber}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {apt.appointmentDate ? new Date(apt.appointmentDate).toLocaleDateString() : '—'}
            {' · '}{apt.startTime}–{apt.endTime}
          </p>
          <Badge className="mt-2" variant={APPOINTMENT_STATUS_VARIANT[apt.status]}>
            {APPOINTMENT_STATUS_LABELS[apt.status]}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionGuard permissions={[PERMISSIONS.APPOINTMENTS_EDIT, PERMISSIONS.APPOINTMENTS_ALL]}>
            <Button asChild variant="outline" size="sm">
              <Link to={appointmentEditPath(id)}>{t('common.edit', 'Edit')}</Link>
            </Button>
            {apt.status === 'SCHEDULED' && (
              <Button size="sm" variant="outline" onClick={() => confirm.mutateAsync(id).then(() => toast.success(t('appointments.detail.toastConfirmed', 'Confirmed')))}>
                {t('appointments.detail.confirm', 'Confirm')}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setNoShowOpen((v) => !v)}>
              {t('appointments.detail.noShow', 'No-show')}
            </Button>
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.APPOINTMENTS_COMPLETE, PERMISSIONS.APPOINTMENTS_ALL]}>
            <Button size="sm" onClick={() => complete.mutateAsync(id).then(() => toast.success(t('appointments.detail.toastCompleted', 'Completed')))}>
              {t('appointments.detail.complete', 'Complete')}
            </Button>
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.APPOINTMENTS_RESCHEDULE, PERMISSIONS.APPOINTMENTS_ALL]}>
            <Button size="sm" variant="outline" onClick={() => setRescheduleOpen((v) => !v)}>
              {t('appointments.detail.reschedule', 'Reschedule')}
            </Button>
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.APPOINTMENTS_CANCEL, PERMISSIONS.APPOINTMENTS_ALL]}>
            <Button size="sm" variant="destructive" onClick={() => setCancelOpen(true)}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.APPOINTMENTS_DELETE, PERMISSIONS.APPOINTMENTS_ALL]}>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                if (!window.confirm(t('appointments.detail.deleteConfirm', 'Soft-delete this appointment?'))) return;
                await remove.mutateAsync(id);
                toast.success(t('appointments.detail.toastDeleted', 'Deleted'));
                navigate(APP_ROUTES.APPOINTMENTS);
              }}
            >
              {t('common.delete', 'Delete')}
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('appointments.detail.details', 'Details')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={t('appointments.detail.patient', 'Patient')} value={
              apt.patientId ? (
                <Link className="underline" to={patientDetailPath(apt.patientId)}>
                  {apt.patient?.fullName} ({apt.patient?.mrn})
                </Link>
              ) : '—'
            } />
            <Row label={t('appointments.detail.doctor', 'Doctor')} value={apt.doctor?.name || '—'} />
            <Row label={t('appointments.detail.branch', 'Branch')} value={apt.branch?.name || '—'} />
            <Row label={t('appointments.detail.service', 'Service')} value={apt.service?.name || '—'} />
            <Row label={t('appointments.detail.type', 'Type')} value={apt.appointmentType} />
            <Row label={t('appointments.detail.source', 'Source')} value={apt.source} />
            <Row label={t('appointments.detail.priority', 'Priority')} value={apt.priority} />
            <Row label={t('appointments.detail.reason', 'Reason')} value={apt.reasonForVisit || '—'} />
            <Row label={t('appointments.detail.notes', 'Notes')} value={apt.notes || '—'} />
            {apt.parentAppointmentId && (
              <Row label={t('appointments.detail.followUpOf', 'Follow-up of')} value={
                <Link className="underline" to={`/appointments/${apt.parentAppointmentId}`}>{t('appointments.detail.parent', 'Parent')}</Link>
              } />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('appointments.detail.resources', 'Resources')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={t('appointments.detail.doctor', 'Doctor')} value={apt.resourceAllocation?.doctorId || apt.doctorId || '—'} />
            <Row label={t('appointments.detail.room', 'Room')} value={apt.roomId || t('appointments.detail.optional', 'Optional')} />
            <Row label={t('appointments.detail.device', 'Device')} value={apt.deviceId || t('appointments.detail.optional', 'Optional')} />
            <Row label={t('appointments.detail.technician', 'Technician')} value={apt.technicianId || t('appointments.detail.optional', 'Optional')} />
            <PermissionGuard permissions={[PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_ALL]}>
              <Button
                className="mt-2"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const date = window.prompt(t('appointments.detail.followUpDatePrompt', 'Follow-up date (YYYY-MM-DD)'));
                  const startTime = window.prompt(t('appointments.detail.startTimePrompt', 'Start time (HH:mm)'), '11:00');
                  if (!date || !startTime) return;
                  const [h, m] = startTime.split(':').map(Number);
                  const endMins = h * 60 + m + 15;
                  const endTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;
                  try {
                    const res = await followUp.mutateAsync({
                      id,
                      payload: { appointmentDate: date, startTime, endTime },
                    });
                    toast.success(t('appointments.detail.toastFollowUpCreated', 'Follow-up created'));
                    navigate(`/appointments/${res.data.appointment.id}`);
                  } catch (err) {
                    toast.error(err?.response?.data?.message || t('appointments.detail.followUpFailed', 'Follow-up failed'));
                  }
                }}
              >
                {t('appointments.detail.createFollowUp', 'Create follow-up')}
              </Button>
            </PermissionGuard>
          </CardContent>
        </Card>
      </div>

      {cancelOpen && (
        <Card>
          <CardHeader><CardTitle>{t('appointments.detail.cancelTitle', 'Cancel appointment')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('appointments.detail.cancelReasonRequired', 'A cancellation reason is mandatory.')}
            </p>
            <Select
              value={cancelReasonCode}
              onChange={(e) => setCancelReasonCode(e.target.value)}
            >
              <option value="">{t('appointments.detail.cancelReasonSelect', 'Select a reason…')}</option>
              {CANCELLATION_REASON_OPTIONS.map((code) => (
                <option key={code} value={code}>
                  {t(`appointments.cancelReason.${code}`, CANCELLATION_REASON_LABELS[code])}
                </option>
              ))}
            </Select>
            {cancelReasonCode === 'OTHER' && (
              <Input
                placeholder={t('appointments.detail.cancelNotePlaceholder', 'Describe the reason (required)')}
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setCancelOpen(false)}>
                {t('common.close', 'Close')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={
                  !cancelReasonCode ||
                  (cancelReasonCode === 'OTHER' && cancelNote.trim().length < 3) ||
                  cancel.isPending
                }
                onClick={async () => {
                  try {
                    await cancel.mutateAsync({
                      id,
                      reasonCode: cancelReasonCode,
                      reason: cancelNote.trim() || undefined,
                    });
                    toast.success(t('appointments.detail.toastCancelled', 'Cancelled'));
                    setCancelOpen(false);
                    setCancelReasonCode('');
                    setCancelNote('');
                  } catch (err) {
                    toast.error(err?.response?.data?.message || t('appointments.detail.cancelFailed', 'Cancel failed'));
                  }
                }}
              >
                {t('appointments.detail.confirmCancel', 'Confirm cancellation')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {noShowOpen && (
        <Card>
          <CardHeader><CardTitle>{t('appointments.detail.noShowTitle', 'Mark as no-show')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder={t('appointments.detail.noShowReasonPlaceholder', 'Reason (optional)')}
              value={noShowReason}
              onChange={(e) => setNoShowReason(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={noShowRecall}
                onChange={(e) => setNoShowRecall(e.target.checked)}
              />
              {t('appointments.detail.noShowRecall', 'Add to recall worklist for rebooking follow-up')}
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setNoShowOpen(false)}>
                {t('common.close', 'Close')}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={noShow.isPending}
                onClick={async () => {
                  try {
                    await noShow.mutateAsync({
                      id,
                      reason: noShowReason.trim() || undefined,
                      addToRecallWorklist: noShowRecall,
                    });
                    toast.success(t('appointments.detail.toastNoShow', 'No-show'));
                    setNoShowOpen(false);
                    setNoShowReason('');
                    setNoShowRecall(false);
                  } catch (err) {
                    toast.error(err?.response?.data?.message || t('appointments.detail.noShowFailed', 'Failed to mark no-show'));
                  }
                }}
              >
                {t('appointments.detail.confirmNoShow', 'Confirm no-show')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {rescheduleOpen && (
        <Card>
          <CardHeader><CardTitle>{t('appointments.detail.reschedule', 'Reschedule')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input type="date" value={rsDate} onChange={(e) => { setRsDate(e.target.value); setRsSlot(null); }} />
            <div className="flex flex-wrap gap-2">
              {(slotsData?.slots || []).map((s) => (
                <button
                  key={s.start}
                  type="button"
                  className={`rounded-md border px-2 py-1 font-mono text-xs ${rsSlot?.start === s.start ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
                  onClick={() => setRsSlot(s)}
                >
                  {s.start}
                </button>
              ))}
            </div>
            <Button
              disabled={!rsSlot || reschedule.isPending}
              onClick={async () => {
                try {
                  const res = await reschedule.mutateAsync({
                    id,
                    payload: {
                      appointmentDate: rsDate,
                      startTime: rsSlot.start,
                      endTime: rsSlot.end,
                    },
                  });
                  toast.success(t('appointments.detail.toastRescheduled', 'Rescheduled'));
                  navigate(`/appointments/${res.data.appointment.id}`);
                } catch (err) {
                  toast.error(err?.response?.data?.message || t('appointments.detail.rescheduleFailed', 'Reschedule failed'));
                }
              }}
            >
              {t('appointments.detail.confirmReschedule', 'Confirm reschedule')}
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
