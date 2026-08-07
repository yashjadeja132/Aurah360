import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';
import { useTranslation } from 'react-i18next';

export function TrendChart({ title, data = [], dataKey = 'value', type = 'line', color = '#0f766e' }) {
  const { t } = useTranslation();
  const Chart = type === 'bar' ? BarChart : LineChart;

  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="h-56 w-full">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <Chart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} hide={data.length > 40} />
              <YAxis tick={{ fontSize: 11 }} width={48} />
              <Tooltip />
              {type === 'bar' ? (
                <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
              ) : (
                <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
              )}
            </Chart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {t('reports.charts.noChartData', 'No chart data for this range.')}
          </p>
        )}
      </div>
    </div>
  );
}

export function FunnelChart({ title, data = [] }) {
  const { t } = useTranslation();
  const max = Math.max(...data.map((d) => d.value || 0), 1);
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="space-y-2">
        {data.map((row) => (
          <div key={row.status || row.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span>{row.status || row.label}</span>
              <span>{row.value}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-teal-700"
                style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
        {!data.length && <p className="text-sm text-muted-foreground">{t('reports.charts.noFunnelData', 'No funnel data.')}</p>}
      </div>
    </div>
  );
}

export default TrendChart;
