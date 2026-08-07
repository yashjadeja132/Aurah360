import { LoginForm } from '@/modules/auth/components/LoginForm';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { APP_ROUTES, PORTAL_ROUTES } from '@/constants/routes';

export default function LoginPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('auth.signIn', 'Sign in')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('auth.signInHint', 'Use your Aurah 360 staff credentials.')}
        </p>
      </div>
      <LoginForm />
      <p className="text-center text-sm">
        <Link
          className="text-primary underline-offset-4 hover:underline"
          to={APP_ROUTES.FORGOT_PASSWORD}
        >
          {t('auth.forgotPassword', 'Forgot password?')}
        </Link>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        <Link className="underline" to={PORTAL_ROUTES.LOGIN}>
          {t('auth.patientPortalLink', 'Patient? Patient portal')}
        </Link>
      </p>
    </div>
  );
}
