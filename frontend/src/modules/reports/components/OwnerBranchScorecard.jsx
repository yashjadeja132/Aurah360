import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/EmptyState';
import { formatMoney, trendDelta } from '@/modules/reports/constants';

function Delta({ today, yesterday }) {
  const { t } = useTranslation();
  const pct = trendDelta(today, yesterday);
  if (pct === null) {
    return (
      <span className="text-xs text-muted-foreground">
        {today ? t('owner.landing.newToday', 'new today') : '—'}
      </span>
    );
  }
  const up = pct >= 0;
  return (
    <span className={up ? 'text-xs text-emerald-700' : 'text-xs text-rose-700'}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  );
}

function MetricCell({ metric, money }) {
  const fmt = (n) => (money ? formatMoney(n) : n);
  return (
    <td className="px-3 py-2">
      <div className="font-medium">{fmt(metric.today)}</div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{fmt(metric.yesterday)}</span>
        <Delta today={metric.today} yesterday={metric.yesterday} />
      </div>
    </td>
  );
}

/**
 * Revenue / new patients / completed treatments for every branch, today against
 * yesterday, with an all-branches total row — so the owner never leaves the
 * landing screen to compare branches.
 */
export function OwnerBranchScorecard({ rows = [], totals, isLoading, isError, error }) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {error?.response?.data?.message ||
          error?.message ||
          t('owner.landing.loadFailed', 'Could not load branch performance.')}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <EmptyState
        title={t('owner.landing.noBranches', 'No branches yet')}
        description={t(
          'owner.landing.noBranchesHint',
          'Add a branch to see revenue and activity compared day over day.'
        )}
      />
    );
  }

  const chartData = rows.map((r) => ({
    label: r.branchCode || r.name,
    today: r.revenue.today,
    yesterday: r.revenue.yesterday,
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile
          label={t('owner.landing.revenue', 'Revenue')}
          metric={totals.revenue}
          money
        />
        <SummaryTile
          label={t('owner.landing.newPatients', 'New patients')}
          metric={totals.patients}
        />
        <SummaryTile
          label={t('owner.landing.treatments', 'Treatments completed')}
          metric={totals.treatments}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('owner.landing.byBranch', 'By branch')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 font-medium">{t('owner.landing.branch', 'Branch')}</th>
                  <th className="px-3 py-2 font-medium">{t('owner.landing.revenue', 'Revenue')}</th>
                  <th className="px-3 py-2 font-medium">{t('owner.landing.newPatients', 'New patients')}</th>
                  <th className="px-3 py-2 font-medium">{t('owner.landing.treatments', 'Treatments completed')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.branchId} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.name}</div>
                      {r.branchCode && (
                        <div className="font-mono text-xs text-muted-foreground">{r.branchCode}</div>
                      )}
                    </td>
                    <MetricCell metric={r.revenue} money />
                    <MetricCell metric={r.patients} />
                    <MetricCell metric={r.treatments} />
                  </tr>
                ))}
                <tr className="border-t-2 bg-muted/30 font-medium">
                  <td className="px-3 py-2">{t('owner.landing.allBranches', 'All branches')}</td>
                  <MetricCell metric={totals.revenue} money />
                  <MetricCell metric={totals.patients} />
                  <MetricCell metric={totals.treatments} />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {t('owner.landing.readingHint', 'Large figure is today; smaller figure is yesterday.')}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('owner.landing.revenueChart', 'Revenue — today vs yesterday')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={64} />
                <Tooltip formatter={(v) => formatMoney(v)} />
                <Legend />
                <Bar
                  dataKey="yesterday"
                  name={t('owner.landing.yesterday', 'Yesterday')}
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="today"
                  name={t('owner.landing.today', 'Today')}
                  fill="#0f766e"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ label, metric, money }) {
  const { t } = useTranslation();
  const fmt = (n) => (money ? formatMoney(n) : n);
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{fmt(metric.today)}</p>
      <div className="mt-1 flex items-center gap-2">
        <Delta today={metric.today} yesterday={metric.yesterday} />
        <span className="text-xs text-muted-foreground">
          {t('owner.landing.vsYesterday', 'vs {{value}} yesterday', { value: fmt(metric.yesterday) })}
        </span>
      </div>
    </div>
  );
}

export default OwnerBranchScorecard;
