import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { usePatientTimeline } from '../hooks/usePatients';

export function PatientTimelinePanel({ patientId }) {
  const { t } = useTranslation();
  const { data: events = [], isLoading } = usePatientTimeline(patientId);

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!events.length) {
    return (
      <EmptyState
        title={t('patients.timeline.noEvents', 'No timeline events')}
        description={t('patients.timeline.noEventsDesc', 'Activity will appear here.')}
      />
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {events.map((ev) => (
        <li key={ev.id} className="relative">
          <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
          <p className="font-medium">{ev.title}</p>
          {ev.description && (
            <p className="text-sm text-muted-foreground">{ev.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {ev.eventType} · {new Date(ev.occurredAt).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default PatientTimelinePanel;
