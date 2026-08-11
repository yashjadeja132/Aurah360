import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatElapsed } from '../hooks/useDoctorDay';

const COLUMN_DEFS = [
  { key: 'waiting', label: ['doctorDay.columns.waiting', 'Waiting'] },
  { key: 'inConsultation', label: ['doctorDay.columns.inConsultation', 'In Consultation'] },
  { key: 'awaitingTreatment', label: ['doctorDay.columns.awaitingTreatment', 'Awaiting Treatment'] },
  { key: 'completed', label: ['doctorDay.columns.completed', 'Completed'] },
];

function PatientCard({ appointment }) {
  const { t } = useTranslation();
  return (
    <Card className={appointment.urgent ? 'border-destructive' : undefined}>
      <CardContent className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {appointment.patient?.fullName || t('doctorDay.unknownPatient', 'Unknown patient')}
          </p>
          {appointment.urgent && (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" aria-hidden />
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {appointment.patient?.mrn}
          {appointment.service?.name ? ` · ${appointment.service.name}` : ''}
        </p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-mono tabular-nums text-muted-foreground">
            {appointment.startTime || '—'}
          </span>
          {appointment.elapsedMinutes != null && (
            <Badge variant={appointment.urgent ? 'destructive' : 'secondary'} className="text-[11px]">
              {formatElapsed(appointment.elapsedMinutes)}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * §0 — the 4 required My Day status columns. Elapsed time shown per card is
 * "time since last status change" (via `updatedAt`, the closest existing timestamp —
 * see `elapsedMinutes` in useDoctorDay.js for why there's no truer per-transition value
 * without a schema change). Waiting patients past the urgent threshold are flagged.
 */
export function MyDayColumns({ columns }) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {COLUMN_DEFS.map(({ key, label }) => {
        const rows = columns[key] || [];
        return (
          <div key={key} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t(...label)} <span className="font-normal">({rows.length})</span>
            </h3>
            <div className="space-y-2">
              {rows.length > 0 ? (
                rows.map((a) => <PatientCard key={a.id} appointment={a} />)
              ) : (
                <Card>
                  <CardContent className="py-6 text-center text-xs text-muted-foreground">
                    {t('doctorDay.columns.empty', 'None')}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MyDayColumns;
