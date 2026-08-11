import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { appointmentDetailPath, appointmentEditPath } from '@/constants/routes';

/**
 * §2.2 roster-impact decision (aurah_flow_admin.md) — shown when a schedule or leave change was
 * blocked (409 ROSTER_IMPACT_CONFIRMATION_REQUIRED) because it conflicts with existing confirmed
 * appointments. The admin picks, per appointment: Reassign / Reschedule (both hand off to the
 * existing appointment screens rather than reinventing that flow here), or Override the whole
 * change with a mandatory reason once every impacted appointment has been reviewed.
 */
export function RosterImpactPanel({ impactedAppointments, onOverride, isSubmitting, onCancel }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  return (
    <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <div>
        <p className="text-sm font-semibold text-destructive">
          {t(
            'doctors.rosterImpact.title',
            'This change conflicts with {{count}} confirmed appointment(s)',
            { count: impactedAppointments.length }
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(
            'doctors.rosterImpact.subtitle',
            'Nothing has been changed yet. Reassign or reschedule each appointment below, or override with a reason to proceed anyway.'
          )}
        </p>
      </div>

      <div className="space-y-2">
        {impactedAppointments.map((apt) => (
          <div
            key={apt.appointmentId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{apt.patientName || t('doctors.rosterImpact.unknownPatient', 'Patient')}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(apt.appointmentDate).toLocaleDateString()} · {apt.startTime}
                {apt.status ? ` · ${apt.status}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={appointmentEditPath(apt.appointmentId)}>
                  {t('doctors.rosterImpact.reassign', 'Reassign')}
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={appointmentDetailPath(apt.appointmentId)}>
                  {t('doctors.rosterImpact.reschedule', 'Reschedule')}
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t pt-3">
        <Label htmlFor="roster-override-reason">
          {t('doctors.rosterImpact.overrideReason', 'Override reason (required to proceed anyway)')}
        </Label>
        <Input
          id="roster-override-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('doctors.rosterImpact.overrideReasonPlaceholder', 'Why proceed despite the conflict?')}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={reason.trim().length < 3 || isSubmitting}
            onClick={() => onOverride(reason.trim())}
          >
            {t('doctors.rosterImpact.overrideAndSave', 'Override and save anyway')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Badge variant="secondary" className="text-[10px]">
            {t('doctors.rosterImpact.audited', 'This override is recorded in the audit trail')}
          </Badge>
        </div>
      </div>
    </div>
  );
}

export default RosterImpactPanel;
