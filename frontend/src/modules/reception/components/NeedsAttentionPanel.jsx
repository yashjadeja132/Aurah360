import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, BellRing, Clock, FileWarning, LogIn, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PaymentDialog } from '@/modules/billing/components/PaymentDialog';
import { useRecordPayment } from '@/modules/billing/hooks/useBilling';
import { formatMoney } from '@/modules/billing/constants';
import { patientDetailPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { useCallPatient } from '../hooks/useReception';
import { ATTENTION_KIND, WAIT_ALERT_MINUTES } from '../hooks/useReceptionDesk';

const CONSENT_LABEL = {
  PRIVACY_NOTICE: 'Privacy notice',
  CARE_RECORD_PROCESSING: 'Care record processing',
};

const KIND_META = {
  [ATTENTION_KIND.WAITING_TOO_LONG]: { icon: Clock, tone: 'destructive' },
  [ATTENTION_KIND.LATE_ARRIVAL]: { icon: AlertTriangle, tone: 'warning' },
  [ATTENTION_KIND.MISSING_CONSENT]: { icon: FileWarning, tone: 'warning' },
  [ATTENTION_KIND.DUE_AT_DESK]: { icon: Wallet, tone: 'secondary' },
};

/**
 * A.1 — the ranked "needs attention now" list the flow diff calls out as missing from the reception
 * dashboard (row A1: "actual is a flat stat-tiles + two-list dashboard — Kavya must scan two full
 * lists herself to find what's urgent").
 *
 * Every row carries its own resolving action, performed IN PLACE: check in (the existing
 * CheckInDialog, opened by the parent), call the waiting patient, or collect the outstanding
 * balance (the same PaymentDialog the invoice screen uses). Nothing here navigates away to be
 * actioned — that is the whole point of the panel.
 */
export function NeedsAttentionPanel({ rows = [], isLoading = false, onCheckIn }) {
  const { t } = useTranslation();
  const call = useCallPatient();
  const [collectTarget, setCollectTarget] = useState(null);
  const recordPayment = useRecordPayment(collectTarget?.id);

  return (
    <Card className="border-warning/40">
      <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="h-4 w-4 text-warning" />
          {t('receptionDesk.attention.title', 'Needs attention now')}
          {!isLoading && rows.length > 0 && <Badge variant="destructive">{rows.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}

        {!isLoading && rows.length === 0 && (
          <EmptyState
            icon={BellRing}
            title={t('receptionDesk.attention.emptyTitle', 'Nothing needs chasing')}
            description={t(
              'receptionDesk.attention.emptyDescription',
              'Nobody is waiting too long, everyone due has checked in, required consents are on file, and no one at the desk owes money.'
            )}
          />
        )}

        {!isLoading && rows.length > 0 && (
          <ul className="divide-y">
            {rows.map((row) => {
              const meta = KIND_META[row.kind] || KIND_META[ATTENTION_KIND.LATE_ARRIVAL];
              const Icon = meta.icon;
              return (
                <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {row.patientId ? (
                          <Link className="text-primary underline" to={patientDetailPath(row.patientId)}>
                            {row.patientName || t('receptionDesk.attention.unknownPatient', 'Unknown patient')}
                          </Link>
                        ) : (
                          row.patientName || t('receptionDesk.attention.unknownPatient', 'Unknown patient')
                        )}
                        {row.patientMrn && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">{row.patientMrn}</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <Badge variant={meta.tone} className="mr-2">
                          {reasonLabel(t, row)}
                        </Badge>
                        {detailLine(t, row)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 sm:pl-4">
                    {row.kind === ATTENTION_KIND.LATE_ARRIVAL && (
                      <PermissionGuard
                        permissions={[PERMISSIONS.RECEPTION_CHECKIN, PERMISSIONS.RECEPTION_ALL]}
                      >
                        <Button size="sm" onClick={() => onCheckIn?.(row.appointment)}>
                          <LogIn className="h-4 w-4" />
                          {t('receptionDesk.attention.checkIn', 'Check in')}
                        </Button>
                      </PermissionGuard>
                    )}

                    {row.kind === ATTENTION_KIND.WAITING_TOO_LONG && (
                      <PermissionGuard
                        permissions={[PERMISSIONS.QUEUE_MANAGE, PERMISSIONS.QUEUE_ALL]}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={call.isPending}
                          onClick={() => call.mutate(row.queueEntry.id)}
                        >
                          {t('receptionDesk.attention.call', 'Call now')}
                        </Button>
                      </PermissionGuard>
                    )}

                    {row.kind === ATTENTION_KIND.MISSING_CONSENT && row.patientId && (
                      <Button asChild size="sm" variant="outline">
                        <Link to={patientDetailPath(row.patientId)}>
                          {t('receptionDesk.attention.recordConsent', 'Record consent')}
                        </Link>
                      </Button>
                    )}

                    {row.kind === ATTENTION_KIND.DUE_AT_DESK && (
                      <PermissionGuard
                        permissions={[PERMISSIONS.BILLING_PAYMENT, PERMISSIONS.BILLING_ALL]}
                      >
                        <Button size="sm" variant="outline" onClick={() => setCollectTarget(row.invoice)}>
                          {t('receptionDesk.attention.collect', 'Collect {{amount}}', {
                            amount: formatMoney(row.amount),
                          })}
                        </Button>
                      </PermissionGuard>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {/* Keyed by invoice id so the dialog remounts and re-derives its pre-filled amount per row. */}
      <PaymentDialog
        key={collectTarget?.id || 'none'}
        open={Boolean(collectTarget)}
        balance={collectTarget?.balanceAmount || 0}
        pending={recordPayment.isPending}
        onClose={() => setCollectTarget(null)}
        onSubmit={(payload) =>
          recordPayment.mutate(payload, { onSuccess: () => setCollectTarget(null) })
        }
      />
    </Card>
  );
}

function reasonLabel(t, row) {
  switch (row.kind) {
    case ATTENTION_KIND.WAITING_TOO_LONG:
      return t('receptionDesk.attention.waitingTooLong', 'Waiting {{count}} min', { count: row.minutes });
    case ATTENTION_KIND.LATE_ARRIVAL:
      return t('receptionDesk.attention.notCheckedIn', 'Past slot, not checked in');
    case ATTENTION_KIND.MISSING_CONSENT:
      return t('receptionDesk.attention.missingConsent', 'Consent missing');
    case ATTENTION_KIND.DUE_AT_DESK:
      return t('receptionDesk.attention.dueAtDesk', 'Owes {{amount}}', {
        amount: formatMoney(row.amount),
      });
    default:
      return '';
  }
}

function detailLine(t, row) {
  switch (row.kind) {
    case ATTENTION_KIND.WAITING_TOO_LONG:
      return t('receptionDesk.attention.waitDetail', 'Token {{token}} · {{doctor}} · over the {{limit}} min mark', {
        token: row.tokenNumber || '—',
        doctor: row.doctorName || t('receptionDesk.attention.noDoctor', 'no doctor set'),
        limit: WAIT_ALERT_MINUTES,
      });
    case ATTENTION_KIND.LATE_ARRIVAL:
      return t('receptionDesk.attention.lateDetail', 'Slot {{time}} · {{doctor}} · {{number}}', {
        time: row.startTime || '—',
        doctor: row.doctorName || t('receptionDesk.attention.noDoctor', 'no doctor set'),
        number: row.appointmentNumber || '—',
      });
    case ATTENTION_KIND.MISSING_CONSENT:
      return t('receptionDesk.attention.consentDetail', 'Not on file: {{purposes}}', {
        purposes: (row.purposes || []).map((p) => CONSENT_LABEL[p] || p).join(', '),
      });
    case ATTENTION_KIND.DUE_AT_DESK:
      return t('receptionDesk.attention.dueDetail', 'Invoice {{number}} · patient is here now', {
        number: row.invoiceNumber || '—',
      });
    default:
      return '';
  }
}

export default NeedsAttentionPanel;
