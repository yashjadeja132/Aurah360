import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircleWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import {
  useEscalationTickets,
  useMarkEscalationTicketHandled,
} from '@/modules/crm/hooks/useCrmExtensions';

const STATUSES = ['OPEN', 'HANDLED'];

/**
 * Human escalation inbox (CRM-001) — free-text patient replies the automation cannot route
 * anywhere else land here (currently WhatsApp inbound only; see
 * NotificationWebhookController#sms/#voice for why SMS/voice inbound capture is a follow-up).
 */
export function CrmEscalationInboxPanel() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('OPEN');
  const { data: tickets = [], isLoading } = useEscalationTickets(status ? { status } : {});
  const markHandled = useMarkEscalationTicketHandled();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t(
          'crm.escalations.subtitle',
          'Free-text patient replies that need a human — currently WhatsApp only'
        )}
      </p>

      <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(`crm.escalations.status.${s}`, s)}
          </option>
        ))}
      </Select>

      {isLoading && <Skeleton className="h-32 w-full" />}

      <div className="space-y-2">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className="flex flex-col gap-2 rounded-xl border bg-card p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {ticket.channel} · {ticket.fromNumber}
                {!ticket.patientId && (
                  <Badge variant="secondary" className="ml-2">
                    {t('crm.escalations.unresolvedPatient', 'Patient not matched')}
                  </Badge>
                )}
              </p>
              <p className="mt-1 text-sm">{ticket.messageBody}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {ticket.receivedAt ? new Date(ticket.receivedAt).toLocaleString() : '—'}
                {ticket.handledAt
                  ? ` · ${t('crm.escalations.handledOn', 'Handled')} ${new Date(ticket.handledAt).toLocaleString()}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={ticket.status === 'OPEN' ? 'warning' : 'secondary'}>
                {t(`crm.escalations.status.${ticket.status}`, ticket.status)}
              </Badge>
              {ticket.status === 'OPEN' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={markHandled.isPending}
                  onClick={() => markHandled.mutate(ticket.id)}
                >
                  {t('crm.escalations.markHandled', 'Mark handled')}
                </Button>
              )}
            </div>
          </div>
        ))}
        {!tickets.length && !isLoading && (
          <EmptyState
            icon={MessageCircleWarning}
            title={t('crm.escalations.empty', 'Nothing here — no escalation tickets match this filter.')}
          />
        )}
      </div>
    </div>
  );
}

export default CrmEscalationInboxPanel;
