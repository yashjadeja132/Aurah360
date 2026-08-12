import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * RX-SAFETY — renders the server's allergy/interaction evaluation.
 *
 * DISPLAY ONLY. The block lives on the server (POST /prescriptions/:id/finalize returns 409
 * PRESCRIPTION_SAFETY_BLOCKED); hiding this component cannot finalize a blocked prescription.
 * The copy here is written for a clinician — raw codes and developer/API text are translated to
 * plain guidance and stripped.
 */

// Doctor-friendly label per advisory code.
const FRIENDLY_LABEL = {
  ALLERGY_HISTORY_NOT_CONFIRMED: 'Confirm the patient’s allergy history before dispensing',
  INTERACTION_SOURCE_NOT_CONFIGURED: 'Review drug interactions manually',
  NO_KNOWN_ALLERGY_UNCONFIRMED: 'Confirm “no known drug allergies”',
};
const FRIENDLY_DETAIL = {
  ALLERGY_HISTORY_NOT_CONFIRMED: 'No allergy history is on file for this patient — please ask and record it.',
  INTERACTION_SOURCE_NOT_CONFIGURED: 'Automatic interaction checking is not enabled — please review the combination yourself.',
};

// Strip any developer/API jargon from server-supplied text.
function sanitize(text) {
  if (!text) return '';
  return String(text)
    .split(/Add rules via|POST \/|GET \/|\/api\/v1|wire a licensed|An empty result/i)[0]
    .replace(/\s+—\s*$/, '')
    .trim();
}

export function PrescriptionSafetyPanel({
  safety,
  overrideReason,
  onOverrideReasonChange,
  readOnly = false,
}) {
  const { t } = useTranslation();
  if (!safety) return null;

  const blocked = safety.status === 'BLOCKED';
  const blockingAlerts = (safety.alerts || []).filter((a) => a.blocking);
  const advisoryAlerts = (safety.alerts || []).filter((a) => !a.blocking);

  // Nothing is actually blocking → show a single calm reminder line, not an alarming panel.
  if (!blocked) {
    return (
      <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <span>
          {t(
            'prescriptions.safety.reminder',
            'No blocking issues. Please confirm the patient’s allergies and review interactions before dispensing.'
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-destructive/60 bg-destructive/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-destructive" />
        <h2 className="text-sm font-semibold">
          {t('prescriptions.safety.title', 'Prescribing safety check')}
        </h2>
        <Badge variant="destructive">{t('prescriptions.safety.blocked', 'Needs review')}</Badge>
      </div>

      {blockingAlerts.length > 0 && (
        <ul className="space-y-2">
          {blockingAlerts.map((a, i) => (
            <li key={`${a.type}-${i}`} className="flex gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{FRIENDLY_DETAIL[a.type] || sanitize(a.detail) || FRIENDLY_LABEL[a.type] || a.type}</span>
            </li>
          ))}
        </ul>
      )}

      {advisoryAlerts.length > 0 && (
        <ul className="space-y-1">
          {advisoryAlerts.map((a, i) => (
            <li key={`${a.type}-${i}`} className="flex gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{FRIENDLY_DETAIL[a.type] || FRIENDLY_LABEL[a.type] || sanitize(a.detail)}</span>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="space-y-2 border-t pt-3">
          {safety.canOverride ? (
            <>
              <Label htmlFor="rx-safety-override-reason">
                {t(
                  'prescriptions.safety.overrideReasonLabel',
                  'Clinical reason for overriding (recorded on the prescription and audit log)'
                )}
              </Label>
              <Input
                id="rx-safety-override-reason"
                value={overrideReason}
                onChange={(e) => onOverrideReasonChange?.(e.target.value)}
                placeholder={t(
                  'prescriptions.safety.overrideReasonPlaceholder',
                  'Minimum 10 characters — why is prescribing this safe for this patient?'
                )}
              />
            </>
          ) : (
            <p className="text-sm text-destructive">
              {t(
                'prescriptions.safety.noOverridePermission',
                'You do not hold the prescribing-safety override permission. Escalate to the prescriber.'
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default PrescriptionSafetyPanel;
