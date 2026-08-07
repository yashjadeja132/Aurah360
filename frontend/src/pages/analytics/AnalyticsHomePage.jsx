import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ANALYTICS_CATEGORIES } from '@/modules/analytics/constants';
import { APP_ROUTES } from '@/constants/routes';

export default function AnalyticsHomePage() {
  const { t } = useTranslation();
  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('analytics.title', 'Analytics')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('analytics.subtitle', 'Executive dashboard and category reports (Module 18).')}
        </p>
      </div>

      <Link
        to={APP_ROUTES.ANALYTICS_EXECUTIVE}
        className="block rounded-xl border bg-card p-5 transition hover:border-teal-700/40"
      >
        <p className="font-semibold">{t('analytics.executiveDashboard.title', 'Executive dashboard')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('analytics.executiveDashboard.hint', "Today’s KPIs with Redis cache")}
        </p>
      </Link>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ANALYTICS_CATEGORIES.map((c) => (
          <Link
            key={c.value}
            to={`${APP_ROUTES.ANALYTICS}/${c.path}`}
            className="rounded-xl border bg-card p-4 transition hover:border-teal-700/40"
          >
            <p className="font-medium">{t(`analytics.categories.${c.value}`, c.label)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('analytics.categoryCardHint', 'Charts · filters · export')}
            </p>
          </Link>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {t('analytics.legacyReportsNote', 'Legacy Module 16 reports remain at')}{' '}
        <Link className="underline" to={APP_ROUTES.REPORTS}>
          /reports
        </Link>
        .
      </p>
    </section>
  );
}
