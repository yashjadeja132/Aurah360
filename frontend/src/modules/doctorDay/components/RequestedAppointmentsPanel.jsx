import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { SlotPicker } from '@/modules/appointments/components/bookingPickers';
import { useAppointmentMutations } from '@/modules/appointments/hooks/useAppointments';
import { useRequestedApprovals } from '../hooks/useDoctorDay';

function formatDay(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
}

/**
 * §1 — Requested appointments needing this doctor's decision. The backend already
 * supports Accept / Propose-alternative / Reject (`AppointmentService.decideApproval`,
 * `acceptAlternative`); this panel is the first frontend surface for it.
 */
function RequestRow({ appointment }) {
  const { t } = useTranslation();
  const { decideApproval } = useAppointmentMutations();
  const [mode, setMode] = useState(null); // null | 'propose' | 'reject'
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState('');

  const reset = () => {
    setMode(null);
    setDate('');
    setSlot(null);
    setReason('');
  };

  const accept = () => {
    decideApproval.mutate({ id: appointment.id, payload: { decision: 'ACCEPTED' } });
  };

  const submitAlternative = () => {
    if (!date || !slot) return;
    decideApproval.mutate(
      {
        id: appointment.id,
        payload: {
          decision: 'ALTERNATIVE_PROPOSED',
          alternative: { appointmentDate: date, startTime: slot.start, endTime: slot.end },
        },
      },
      { onSuccess: reset }
    );
  };

  const submitReject = () => {
    if (!reason.trim()) return;
    decideApproval.mutate(
      { id: appointment.id, payload: { decision: 'REJECTED', reason: reason.trim() } },
      { onSuccess: reset }
    );
  };

  return (
    <li className="space-y-3 border-b px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">
            {appointment.patient?.fullName || t('doctorDay.unknownPatient', 'Unknown patient')}
          </p>
          <p className="text-xs text-muted-foreground">
            {appointment.patient?.mrn}
            {appointment.service?.name ? ` · ${appointment.service.name}` : ''}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('doctorDay.requested.requestedFor', 'Requested for')}{' '}
            <span className="font-medium text-foreground">
              {formatDay(appointment.appointmentDate)} {appointment.startTime}
            </span>
          </p>
        </div>
        <Badge variant="warning">{t('doctorDay.requested.pending', 'Pending approval')}</Badge>
      </div>

      {mode === null && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={accept} disabled={decideApproval.isPending}>
            {t('doctorDay.requested.accept', 'Accept')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMode('propose')}>
            {t('doctorDay.requested.propose', 'Propose alternative')}
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setMode('reject')}>
            {t('doctorDay.requested.reject', 'Reject')}
          </Button>
        </div>
      )}

      {mode === 'propose' && (
        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          <SlotPicker
            branchId={appointment.branchId}
            doctorId={appointment.doctorId}
            date={date}
            onDateChange={(v) => {
              setDate(v);
              setSlot(null);
            }}
            slot={slot}
            onSlotChange={setSlot}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={submitAlternative}
              disabled={!date || !slot || decideApproval.isPending}
            >
              {t('doctorDay.requested.sendProposal', 'Send to patient')}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              {t('doctorDay.requested.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      )}

      {mode === 'reject' && (
        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          <textarea
            className="min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder={t('doctorDay.requested.reasonPlaceholder', 'Reason for declining (required)')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={submitReject}
              disabled={!reason.trim() || decideApproval.isPending}
            >
              {t('doctorDay.requested.confirmReject', 'Confirm reject')}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              {t('doctorDay.requested.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

export function RequestedAppointmentsPanel({ doctorId }) {
  const { t } = useTranslation();
  const { items, isLoading } = useRequestedApprovals(doctorId);

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t('doctorDay.requested.title', 'Requested appointments')}{' '}
        <span className="font-normal">({items.length})</span>
      </h2>
      <Card className="overflow-hidden">
        {isLoading ? (
          <CardContent className="space-y-2 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        ) : items.length > 0 ? (
          <ul>
            {items.map((a) => (
              <RequestRow key={a.id} appointment={a} />
            ))}
          </ul>
        ) : (
          <CardContent className="py-6">
            <EmptyState
              icon={CalendarCheck2}
              title={t('doctorDay.requested.emptyTitle', 'No pending requests')}
              description={t(
                'doctorDay.requested.emptyDescription',
                'Nothing is waiting on your approval right now.'
              )}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default RequestedAppointmentsPanel;
