import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HeartPulse } from 'lucide-react';
import { APP_CONFIG } from '@/constants/config';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';

export function AuthLayout() {
  const { t } = useTranslation();
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,hsl(158_35%_94%),hsl(40_40%_96%)_45%,hsl(34_50%_92%))]" />
      <div className="absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 -z-10 h-72 w-72 rounded-full bg-accent/40 blur-3xl" />

      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-elev-md">
            <HeartPulse className="h-6 w-6" />
          </div>
          <p className="font-display text-3xl font-semibold tracking-tight text-primary">
            {APP_CONFIG.name}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('app.tagline', 'Staff portal for Aurah 360 skin, hair & laser clinic')}
          </p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card/95 p-6 shadow-elev-lg backdrop-blur sm:p-8">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;
