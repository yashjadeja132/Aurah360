import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/constants/config';
import { PORTAL_ROUTES, APP_ROUTES } from '@/constants/routes';
import { usePatientLogin } from '@/modules/patientPortal/hooks/usePatientPortal';
import { patientStorage, PATIENT_STORAGE_KEYS } from '@/modules/patientPortal/storage';

export default function PatientLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = usePatientLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (patientStorage.get(PATIENT_STORAGE_KEYS.ACCESS_TOKEN)) {
    return <Navigate to={PORTAL_ROUTES.DASHBOARD} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      toast.success(t('portal.login.welcomeBack', 'Welcome back'));
      navigate(PORTAL_ROUTES.DASHBOARD);
    } catch (err) {
      toast.error(err?.response?.data?.message || t('portal.login.loginFailed', 'Login failed'));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#ccfbf1_0%,_#f8fafc_50%,_#fff_100%)] px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white/90 p-6 shadow-sm">
        <p className="font-display text-2xl font-semibold text-teal-900">{APP_CONFIG.name}</p>
        <h1 className="mt-1 text-lg font-medium">{t('portal.login.title', 'Patient Portal')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('portal.login.subtitle', 'Sign in to view appointments, records, and bills.')}</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block space-y-1 text-sm">
            <span>{t('portal.login.emailLabel', 'Email')}</span>
            <input
              type="email"
              required
              className="w-full rounded-md border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('portal.login.emailPlaceholder', 'you@example.com')}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span>{t('portal.login.passwordLabel', 'Password')}</span>
            <input
              type="password"
              required
              className="w-full rounded-md border px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Button type="submit" className="w-full bg-teal-800 hover:bg-teal-900" disabled={login.isPending}>
            {login.isPending ? t('portal.login.signingIn', 'Signing in…') : t('portal.login.signIn', 'Sign in')}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t('portal.login.staffPrompt', 'Staff?')} <Link className="underline" to={APP_ROUTES.LOGIN}>{t('portal.login.staffLoginLink', 'Staff login')}</Link>
        </p>
      </div>
    </div>
  );
}
