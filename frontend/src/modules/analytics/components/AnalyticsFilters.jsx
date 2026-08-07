import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PERIODS } from '../constants';

export function AnalyticsFilters({ value, onChange, onApply, showPeriod = true }) {
  const { t } = useTranslation();
  const v = value || {};
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      {showPeriod && (
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t('analytics.filters.period', 'Period')}</span>
          <select
            className="block rounded-md border bg-background px-3 py-2"
            value={v.period || 'monthly'}
            onChange={(e) => onChange({ ...v, period: e.target.value })}
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {t(`analytics.periods.${p.value}`, p.label)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="space-y-1 text-sm">
        <span className="text-muted-foreground">{t('analytics.filters.from', 'From')}</span>
        <input
          type="date"
          className="block rounded-md border bg-background px-3 py-2"
          value={v.dateFrom || ''}
          onChange={(e) => onChange({ ...v, dateFrom: e.target.value, period: 'custom' })}
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="text-muted-foreground">{t('analytics.filters.to', 'To')}</span>
        <input
          type="date"
          className="block rounded-md border bg-background px-3 py-2"
          value={v.dateTo || ''}
          onChange={(e) => onChange({ ...v, dateTo: e.target.value, period: 'custom' })}
        />
      </label>
      <Button type="button" onClick={onApply}>
        {t('analytics.filters.apply', 'Apply')}
      </Button>
    </div>
  );
}
