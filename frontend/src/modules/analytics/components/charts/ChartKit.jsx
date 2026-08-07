import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useTranslation } from 'react-i18next';

const COLORS = ['#0f766e', '#1d4ed8', '#b45309', '#be123c', '#7c3aed', '#0e7490'];

function Empty({ title }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-56 items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">
      {t('analytics.charts.noDataFor', 'No data for {{title}}', { title })}
    </div>
  );
}

export function AnalyticsLineChart({ title, data = [], dataKey = 'value', xKey = 'date' }) {
  if (!data.length) return <Empty title={title} />;
  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={48} />
          <Tooltip />
          <Line type="monotone" dataKey={dataKey} stroke="#0f766e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function AnalyticsBarChart({ title, data = [], dataKey = 'count', xKey = 'label' }) {
  if (!data.length) return <Empty title={title} />;
  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={48} />
          <Tooltip />
          <Bar dataKey={dataKey} fill="#1d4ed8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function AnalyticsAreaChart({ title, data = [], dataKey = 'value', xKey = 'date' }) {
  if (!data.length) return <Empty title={title} />;
  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={48} />
          <Tooltip />
          <Area type="monotone" dataKey={dataKey} stroke="#0f766e" fill="#99f6e4" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function AnalyticsPieChart({ title, data = [], nameKey = 'name', valueKey = 'value', donut }) {
  if (!data.length) return <Empty title={title} />;
  return (
    <ChartCard title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            innerRadius={donut ? 50 : 0}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function HeatmapPlaceholder({ title }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title || t('analytics.charts.heatMapDefault', 'Heat map')}</h3>
      <p className="text-sm text-muted-foreground">
        {t('analytics.charts.heatMapPlaceholder', 'Heat map charts are future-ready (placeholder).')}
      </p>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="h-56 w-full">{children}</div>
    </div>
  );
}
