import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * RX-SAFETY — renders the server's allergy/interaction evaluation.
 *
 * This panel is DISPLAY ONLY. The block lives on the server (POST /prescriptions/:id/finalize
 * returns 409 PRESCRIPTION_SAFETY_BLOCKED); hiding or patching this component cannot finalize a
 * blocked prescription. It exists so the block and its override are usable, and so the honest
 * "nothing was checked" state is visible rather than implied.
 */
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

  return (
    <div
      className={`space-y-3 rounded-lg border p-4 ${
        blocked ? 'border-destructive/60 bg-destructive/5' : 'bg-muted/30'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {blocked ? (
          <ShieldAlert className="h-4 w-4 text-destructive" />
        ) : (
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        )}
        <h2 className="text-sm font-semibold">
          {t('prescriptions.safety.title', 'Prescribing safety check')}
        </h2>
        <Badge variant={blocked ? 'destructive' : safety.status === 'WARN' ? 'warning' : 'success'}>
          {safety.status}
        </Badge>
      </div>

      {blockingAlerts.length > 0 && (
        <ul className="space-y-2">
          {blockingAlerts.map((a, i) => (
            <li key={`${a.type}-${i}`} className="flex gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{a.type}</strong> — {a.detail}
              </span>
            </li>
          ))}
        </ul>
      )}

      {advisoryAlerts.length > 0 && (
        <ul className="space-y-1">
          {advisoryAlerts.map((a, i) => (
            <li key={`${a.type}-${i}`} className="flex gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{a.type}</strong> — {a.detail}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Coverage disclosure — an empty result must never read as "checked, all clear". */}
      <div className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
        <p>
          {t('prescriptions.safety.allergyScope', 'Allergy check:')}{' '}
          {safety.allergy?.historyStatus} · {safety.allergy?.limits}
        </p>
        <p>
          {t('prescriptions.safety.interactionScope', 'Interaction check:')}{' '}
          {safety.interaction?.checked
            ? t('prescriptions.safety.interactionChecked', 'source')
            : t('prescriptions.safety.interactionNotChecked', 'NOT PERFORMED —')}{' '}
          {safety.interaction?.source} · {safety.interaction?.note}
        </p>
      </div>

      {blocked && !readOnly && (
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
