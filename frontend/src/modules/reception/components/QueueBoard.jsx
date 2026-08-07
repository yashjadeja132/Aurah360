import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { QueueStatusBadge, PriorityBadge, WaitingTimer } from './QueueBadges';
import {
  useCallPatient,
  useRecallPatient,
  useSkipPatient,
  useStartConsultation,
  useCompleteQueue,
  useCallNext,
  useTransferQueue,
  useReorderQueue,
} from '../hooks/useReception';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export function QueueBoard({ entries = [], doctors = [] }) {
  const { t } = useTranslation();
  const call = useCallPatient();
  const recall = useRecallPatient();
  const skip = useSkipPatient();
  const start = useStartConsultation();
  const complete = useCompleteQueue();
  const reorder = useReorderQueue();
  const transfer = useTransferQueue();
  const [transferId, setTransferId] = useState(null);
  const [transferDoctorId, setTransferDoctorId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const waiting = entries.filter((e) => e.queueStatus === 'WAITING');

  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('reception.queue.empty')}</p>
      )}
      {entries.map((entry, idx) => (
        <div
          key={entry.id}
          className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-2xl font-bold tracking-tight text-primary">
                {entry.tokenNumber}
              </span>
              <QueueStatusBadge status={entry.queueStatus} />
              <PriorityBadge priority={entry.priority} />
              {entry.isWalkIn && (
                <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium">
                  {t('reception.walkIn.label')}
                </span>
              )}
              {entry.isLate && (
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  {t('reception.late')}
                </span>
              )}
            </div>
            <p className="font-medium">
              {entry.patient?.fullName || t('reception.patient')}{' '}
              <span className="text-muted-foreground">({entry.patient?.mrn})</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {t('reception.doctorPrefix')} {entry.doctor?.name || '—'} · {t('reception.queue.estWait', { count: entry.estimatedWaitTime || 0 })} ·{' '}
              <WaitingTimer arrivalTime={entry.arrivalTime} />
            </p>
          </div>

          <PermissionGuard permissions={[PERMISSIONS.QUEUE_MANAGE, PERMISSIONS.QUEUE_ALL]}>
            <div className="flex flex-wrap gap-2">
              {entry.queueStatus === 'WAITING' && (
                <>
                  <Button size="sm" onClick={() => call.mutate(entry.id)}>
                    {t('reception.actions.call')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => skip.mutate(entry.id)}>
                    {t('reception.actions.skip')}
                  </Button>
                  {idx > 0 && waiting.some((w) => w.id === entry.id) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        reorder.mutate({
                          id: entry.id,
                          payload: { beforeId: waiting[0]?.id },
                        })
                      }
                    >
                      {t('reception.actions.moveUp')}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setTransferId(entry.id)}>
                    {t('reception.actions.transfer')}
                  </Button>
                </>
              )}
              {entry.queueStatus === 'CALLED' && (
                <>
                  <Button size="sm" onClick={() => recall.mutate(entry.id)}>
                    {t('reception.actions.recall')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => start.mutate(entry.id)}>
                    {t('reception.actions.start')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => skip.mutate(entry.id)}>
                    {t('reception.actions.skip')}
                  </Button>
                </>
              )}
              {entry.queueStatus === 'IN_CONSULTATION' && (
                <Button size="sm" onClick={() => complete.mutate(entry.id)}>
                  {t('reception.actions.complete')}
                </Button>
              )}
              {entry.queueStatus === 'SKIPPED' && (
                <Button size="sm" onClick={() => call.mutate(entry.id)}>
                  {t('reception.actions.callAgain')}
                </Button>
              )}
            </div>
          </PermissionGuard>
        </div>
      ))}

      {transferId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl border bg-card p-5 shadow-lg">
            <h3 className="font-semibold">{t('reception.transfer.title')}</h3>
            <Select
              value={transferDoctorId}
              onChange={(e) => setTransferDoctorId(e.target.value)}
            >
              <option value="">{t('reception.filters.selectDoctor')}</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.doctorCode} — {d.user?.fullName || d.name || t('reception.doctor')}
                </option>
              ))}
            </Select>
            <Input
              placeholder={t('reception.transfer.reasonPlaceholder')}
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTransferId(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                disabled={!transferDoctorId || transferReason.trim().length < 3 || transfer.isPending}
                onClick={async () => {
                  await transfer.mutateAsync({
                    id: transferId,
                    payload: { doctorId: transferDoctorId, reason: transferReason },
                  });
                  setTransferId(null);
                  setTransferDoctorId('');
                  setTransferReason('');
                }}
              >
                {t('reception.actions.transfer')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DoctorQueueCard({ doctorId, doctorName, entries = [], summary }) {
  const { t } = useTranslation();
  const callNext = useCallNext();
  const doctorEntries = entries.filter((e) => e.doctorId === doctorId);
  const waiting = doctorEntries.filter((e) => e.queueStatus === 'WAITING').length;
  const current = doctorEntries.find((e) =>
    ['CALLED', 'IN_CONSULTATION'].includes(e.queueStatus)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-semibold">
          {doctorName || t('reception.doctor')}
        </CardTitle>
        <PermissionGuard permissions={[PERMISSIONS.QUEUE_MANAGE, PERMISSIONS.QUEUE_ALL]}>
          <Button size="sm" onClick={() => callNext.mutate(doctorId)} disabled={callNext.isPending}>
            {t('reception.actions.callNext')}
          </Button>
        </PermissionGuard>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-3">
          <span>
            {t('reception.stats.currentToken')}: <strong>{current?.tokenNumber || '—'}</strong>
          </span>
          <span>
            {t('reception.stats.waiting')}: <strong>{waiting}</strong>
          </span>
          <span>
            {t('reception.stats.doneShort')}:{' '}
            <strong>
              {doctorEntries.filter((e) => e.queueStatus === 'COMPLETED').length}
            </strong>
          </span>
        </div>
        <div className="space-y-1">
          {doctorEntries
            .filter((e) => !['COMPLETED', 'CANCELLED'].includes(e.queueStatus))
            .slice(0, 5)
            .map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1">
                <span className="font-mono font-semibold">{e.tokenNumber}</span>
                <QueueStatusBadge status={e.queueStatus} className="text-[10px]" />
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
