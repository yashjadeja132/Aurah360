export function KpiCard({ label, value, hint, trend }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value ?? '—'}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {trend != null && (
          <span className={trend >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}

export default KpiCard;
