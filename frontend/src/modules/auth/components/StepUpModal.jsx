import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { stepUpApi } from '@/modules/auth/api/stepUpApi';

/**
 * SEC-002 — first frontend step-up UI in the app. Confirms the current password (or a 6-digit
 * MFA code, if the user has MFA enabled) and hands the resulting one-time step-up token back to
 * the caller via `onVerified`, which attaches it as the `x-step-up-token` header on the
 * privileged request it is unlocking. Deliberately minimal: one field, one submit.
 */
export function StepUpModal({ open, onOpenChange, onVerified, title, description }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('password');
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const close = () => {
    setValue('');
    setIsSubmitting(false);
    onOpenChange?.(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!value) return;
    setIsSubmitting(true);
    try {
      const payload = mode === 'password' ? { password: value } : { mfaToken: value };
      const res = await stepUpApi.verify(payload);
      onVerified?.(res.data.stepUpToken);
      close();
    } catch (err) {
      toast.error(err.response?.data?.message || t('auth.stepUp.failed', 'Re-authentication failed'));
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title || t('auth.stepUp.title', 'Confirm it’s you')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {description ||
              t('auth.stepUp.description', 'This is a sensitive action. Re-enter your password or MFA code to continue.')}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="stepUpValue">
              {mode === 'password'
                ? t('auth.stepUp.passwordLabel', 'Current password')
                : t('auth.stepUp.mfaLabel', '6-digit MFA code')}
            </Label>
            <Input
              id="stepUpValue"
              type={mode === 'password' ? 'password' : 'text'}
              autoComplete={mode === 'password' ? 'current-password' : 'one-time-code'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={mode === 'password' ? undefined : 6}
              autoFocus
            />
          </div>
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => {
              setMode((m) => (m === 'password' ? 'mfa' : 'password'));
              setValue('');
            }}
          >
            {mode === 'password'
              ? t('auth.stepUp.useMfaInstead', 'Use MFA code instead')
              : t('auth.stepUp.usePasswordInstead', 'Use password instead')}
          </button>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || !value}>
              {isSubmitting ? t('auth.stepUp.verifying', 'Verifying…') : t('auth.stepUp.confirm', 'Confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default StepUpModal;
