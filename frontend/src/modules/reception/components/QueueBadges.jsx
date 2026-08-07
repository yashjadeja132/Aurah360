import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import {
  QUEUE_STATUS_LABELS,
  QUEUE_PRIORITY_LABELS,
  STATUS_BADGE_VARIANT,
} from '../constants';

export function QueueStatusBadge({ status, className }) {
  const { t } = useTranslation();
  return (
    <Badge
      variant={STATUS_BADGE_VARIANT[status] || 'outline'}
      className={cn('px-3 py-1 text-sm font-semibold uppercase tracking-wide', className)}
    >
      {t(`reception.status.${status}`, QUEUE_STATUS_LABELS[status] || status)}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }) {
  const { t } = useTranslation();
  if (!priority || priority === 'NORMAL') return null;
  const colors = {
    EMERGENCY: 'bg-red-600 text-white',
    VIP: 'bg-amber-500 text-white',
    PREGNANT: 'bg-pink-500 text-white',
    SENIOR_CITIZEN: 'bg-sky-600 text-white',
    CHILDREN: 'bg-teal-600 text-white',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold',
        colors[priority] || 'bg-secondary text-secondary-foreground',
        className
      )}
    >
      {t(`reception.priority.${priority}`, QUEUE_PRIORITY_LABELS[priority] || priority)}
    </span>
  );
}

export function WaitingTimer({ arrivalTime, className }) {
  const { t } = useTranslation();
  if (!arrivalTime) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(arrivalTime).getTime()) / 60000));
  return (
    <span className={cn('tabular-nums text-sm text-muted-foreground', className)}>
      {t('reception.wait', { count: mins })}
    </span>
  );
}
