import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { loginSchema } from '../validation/loginSchema';
import {
  useLoginMutation,
  useVerifyMfaMutation,
  useStartMfaEnrollmentMutation,
  useConfirmMfaEnrollmentMutation,
} from '../hooks/useAuthMutations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { APP_ROUTES } from '@/constants/routes';

export function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();
  const verifyMfaMutation = useVerifyMfaMutation();
  const startMfaEnrollmentMutation = useStartMfaEnrollmentMutation();
  const confirmMfaEnrollmentMutation = useConfirmMfaEnrollmentMutation();

  const [mfaChallengeToken, setMfaChallengeToken] = useState(null);
  const [mfaCode, setMfaCode] = useState('');

  // SEC-021 — privileged role, password ok, but MFA enrollment is required before a session
  // is issued. `mfaSetupToken` stands in for a session on the setup/start + setup/confirm calls.
  const [mfaSetupToken, setMfaSetupToken] = useState(null);
  const [mfaSetup, setMfaSetup] = useState(null); // { secret, otpauthUri }
  const [enrollCode, setEnrollCode] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values) => {
    try {
      const response = await loginMutation.mutateAsync(values);
      if (response.data.mfaRequired) {
        setMfaChallengeToken(response.data.mfaChallengeToken);
        return;
      }
      if (response.data.mfaSetupRequired) {
        setMfaSetupToken(response.data.mfaSetupToken);
        const startResponse = await startMfaEnrollmentMutation.mutateAsync(response.data.mfaSetupToken);
        setMfaSetup(startResponse.data);
        return;
      }
      toast.success('Welcome back');
      navigate(APP_ROUTES.DASHBOARD, { replace: true });
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
    }
  };

  const onVerifyMfa = async (e) => {
    e.preventDefault();
    try {
      await verifyMfaMutation.mutateAsync({ challengeToken: mfaChallengeToken, token: mfaCode });
      toast.success('Welcome back');
      navigate(APP_ROUTES.DASHBOARD, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid MFA code');
    }
  };

  const onConfirmMfaEnrollment = async (e) => {
    e.preventDefault();
    try {
      const response = await confirmMfaEnrollmentMutation.mutateAsync({
        token: enrollCode,
        mfaSetupToken,
      });
      toast.success('MFA enabled — welcome back');
      navigate(APP_ROUTES.DASHBOARD, { replace: true, state: { mfaBackupCodes: response.data.backupCodes } });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid MFA code');
    }
  };

  if (mfaSetupToken) {
    return (
      <form onSubmit={onConfirmMfaEnrollment} className="space-y-5" noValidate>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {t(
              'auth.mfaSetupRequired',
              'Your role requires two-factor authentication. Scan this into an authenticator app, or enter the key manually:'
            )}
          </p>
          {mfaSetup ? (
            <p className="break-all rounded-lg bg-muted p-3 font-mono text-xs">{mfaSetup.secret}</p>
          ) : (
            <p className="text-sm text-muted-foreground">{t('auth.loading', 'Loading…')}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="enrollCode">{t('auth.mfaCode', '6-digit code')}</Label>
          <Input
            id="enrollCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={enrollCode}
            onChange={(e) => setEnrollCode(e.target.value)}
            autoFocus
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={confirmMfaEnrollmentMutation.isPending || !mfaSetup || enrollCode.length < 6}
        >
          {t('auth.mfaEnable', 'Enable MFA and sign in')}
        </Button>
      </form>
    );
  }

  if (mfaChallengeToken) {
    return (
      <form onSubmit={onVerifyMfa} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="mfaCode">{t('auth.mfaCode', '6-digit code')}</Label>
          <Input
            id="mfaCode"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full" disabled={verifyMfaMutation.isPending || mfaCode.length < 6}>
          {t('auth.mfaVerify', 'Verify')}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="email">{t('auth.email', 'Email')}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="you@aurah360.com"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t('auth.password', 'Password')}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register('password')}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
        {loginMutation.isPending ? t('auth.signingIn', 'Signing in…') : t('auth.signIn', 'Sign in')}
      </Button>
    </form>
  );
}

export default LoginForm;
