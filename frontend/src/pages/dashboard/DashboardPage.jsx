import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users,
  HeartPulse,
  CalendarCheck2,
  IndianRupee,
  ShieldCheck,
  ArrowUpRight,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS, ROLE_LABELS } from '@/constants/rbac';
import { hasAnyPermission } from '@/utils/permissions';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const permissions = user?.permissions || [];
  const greetingName = user?.firstName || user?.fullName?.split(' ')[0] || t('dashboard.thereFallback');

  const QUICK_LINKS = [
    {
      to: APP_ROUTES.PATIENTS,
      label: t('dashboard.quickLinks.patients.label'),
      description: t('dashboard.quickLinks.patients.description'),
      icon: HeartPulse,
      permissions: [PERMISSIONS.PATIENTS_VIEW, PERMISSIONS.PATIENTS_ALL],
    },
    {
      to: APP_ROUTES.APPOINTMENTS,
      label: t('dashboard.quickLinks.appointments.label'),
      description: t('dashboard.quickLinks.appointments.description'),
      icon: CalendarCheck2,
      permissions: [PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_ALL],
    },
    {
      to: APP_ROUTES.BILLING,
      label: t('dashboard.quickLinks.billing.label'),
      description: t('dashboard.quickLinks.billing.description'),
      icon: IndianRupee,
      permissions: [PERMISSIONS.BILLING_VIEW, PERMISSIONS.BILLING_ALL],
    },
    {
      to: APP_ROUTES.STAFF,
      label: t('dashboard.quickLinks.staff.label'),
      description: t('dashboard.quickLinks.staff.description'),
      icon: Users,
      permissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_ALL],
    },
  ];
  const visibleLinks = QUICK_LINKS.filter((l) => hasAnyPermission(permissions, l.permissions));

  return (
    <section className="space-y-8">
      <PageHeader
        title={t('dashboard.welcome', { name: greetingName })}
        description={t('dashboard.signedInAs', { role: ROLE_LABELS[user?.role] || user?.role })}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('dashboard.yourRole')}
          value={ROLE_LABELS[user?.role] || user?.role}
          hint={t('dashboard.accessScope')}
          icon={ShieldCheck}
          tone="info"
        />
        <StatCard
          label={t('dashboard.permissions')}
          value={permissions.length}
          hint={t('dashboard.grantedToAccount')}
          icon={KeyRound}
          tone="success"
        />
        <StatCard label={t('dashboard.branch')} value={user?.branchName || t('dashboard.allBranches')} hint={t('dashboard.currentScope')} icon={Users} />
        <StatCard label={t('dashboard.session')} value={t('dashboard.secure')} hint={t('dashboard.sessionHint')} icon={ShieldCheck} tone="success" />
      </div>

      {visibleLinks.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t('dashboard.quickActions')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visibleLinks.map(({ to, label, description, icon: Icon }) => (
              <Link key={to} to={to} className="group">
                <Card interactive className="h-full">
                  <CardContent className="flex h-full flex-col justify-between p-5">
                    <div>
                      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <p className="font-medium text-foreground">{label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                    </div>
                    <span className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                      {t('dashboard.open')} <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.yourAccount')}</CardTitle>
            <CardDescription>{t('dashboard.yourAccountDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={APP_ROUTES.PROFILE}>{t('dashboard.viewProfile')}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={APP_ROUTES.CHANGE_PASSWORD}>{t('dashboard.changePassword')}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.needSomethingElse')}</CardTitle>
            <CardDescription>{t('dashboard.useSidebar')}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t('dashboard.sidebarGroupsDescription')}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
