import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function ReportFilters({ value, onChange, onApply, onSave, savedFilters = [], onLoadSaved }) {
  const { t } = useTranslation();
  const v = value || {};

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t('reports.filters.from', 'From')}</span>
          <input
            type="date"
            className="w-full rounded-md border bg-background px-3 py-2"
            value={v.dateFrom || ''}
            onChange={(e) => onChange({ ...v, dateFrom: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t('reports.filters.to', 'To')}</span>
          <input
            type="date"
            className="w-full rounded-md border bg-background px-3 py-2"
            value={v.dateTo || ''}
            onChange={(e) => onChange({ ...v, dateTo: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t('reports.filters.paymentStatus', 'Payment status')}</span>
          <select
            className="w-full rounded-md border bg-background px-3 py-2"
            value={v.paymentStatus || ''}
            onChange={(e) => onChange({ ...v, paymentStatus: e.target.value || undefined })}
          >
            <option value="">{t('reports.filters.paymentStatusAll', 'All')}</option>
            <option value="PENDING">{t('reports.filters.paymentStatusPending', 'Pending')}</option>
            <option value="PARTIALLY_PAID">{t('reports.filters.paymentStatusPartiallyPaid', 'Partially paid')}</option>
            <option value="PAID">{t('reports.filters.paymentStatusPaid', 'Paid')}</option>
            <option value="REFUNDED">{t('reports.filters.paymentStatusRefunded', 'Refunded')}</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t('reports.filters.leadSource', 'Lead source')}</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2"
            placeholder={t('reports.filters.leadSourcePlaceholder', 'e.g. Instagram')}
            value={v.leadSource || ''}
            onChange={(e) => onChange({ ...v, leadSource: e.target.value || undefined })}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onApply}>
          {t('reports.filters.applyFilters', 'Apply filters')}
        </Button>
        {onSave ? (
          <Button type="button" variant="outline" onClick={onSave}>
            {t('reports.filters.saveFilters', 'Save filters')}
          </Button>
        ) : null}
        {savedFilters?.length ? (
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            defaultValue=""
            onChange={(e) => {
              const f = savedFilters.find((x) => x.id === e.target.value);
              if (f && onLoadSaved) onLoadSaved(f);
              e.target.value = '';
            }}
          >
            <option value="" disabled>
              {t('reports.filters.savedFilters', 'Saved filters…')}
            </option>
            {savedFilters.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}

export default ReportFilters;
