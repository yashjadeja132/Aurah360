import { cn } from '@/utils/cn';

const TONES = {
  default: 'bg-primary/10 text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  info: 'bg-info-soft text-info',
  destructive: 'bg-destructive/10 text-destructive',
};

/** Compact KPI tile used on role dashboards (§17.4 Global dashboard). */
export function StatCard({ label, value, hint, icon: Icon, tone = 'default', className }) {
  return (
    <div className={cn('rounded-xl border border-border/80 bg-card p-5 shadow-elev-sm', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {Icon && (
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TONES[tone] || TONES.default)}>
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
    </div>
  );
}

export default StatCard;
