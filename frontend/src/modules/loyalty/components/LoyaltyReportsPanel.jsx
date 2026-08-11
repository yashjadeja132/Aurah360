import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/constants/rbac';
import { hasAnyPermission } from '@/utils/permissions';
import { LOYALTY_REPORT_CATEGORIES } from '@/modules/reports/constants';
import { useReportGenerate } from '@/modules/reports/hooks/useReports';
import { ExportDialog } from '@/modules/reports/components/ExportDialog';

/**
 * Loyalty Program → Reports tab.
 *
 * Deliberately reuses the generic reporting mechanism end to end rather than a parallel stack:
 * `useReportGenerate`/`reportsApi.generate` for [View] and `ExportDialog` (step-up aware, same
 * component the Reports workspace uses) for [Export]. The categories are just REPORT_TYPE values
 * — see backend `LOYALTY_REPORT_TYPE_LIST` — that the server additionally gates behind
 * LOYALTY_REPORTS_VIEW/LOYALTY_REPORTS_EXPORT on top of the generic REPORTS_VIEW/REPORTS_EXPORT
 * the shared route already checks.
 *
 * Fidelity: Liability/Issuance/Redemption/Expiry/Referral/Audit View are computed directly from
 * the ledger/audit log (full-fidelity). Program Impact and Fraud Signals are explicitly
 * best-effort — see the `note` the backend returns in `meta` and the badges below — because this
 * codebase has no cohort/attribution methodology or fraud-scoring model to draw on.
 */
export function LoyaltyReportsPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canExport = hasAnyPermission(user?.permissions, [
    PERMISSIONS.LOYALTY_REPORTS_EXPORT,
    PERMISSIONS.LOYALTY_ALL,
  ]);

  const [category, setCategory] = useState(LOYALTY_REPORT_CATEGORIES[0].value);
  const [draft, setDraft] = useState({ branchId: '', dateFrom: '', dateTo: '' });
  const [filters, setFilters] = useState({});
  const [exportOpen, setExportOpen] = useState(false);

  const { data, isLoading, isFetching, refetch } = useReportGenerate(category, filters);

  const meta = useMemo(
    () => LOYALTY_REPORT_CATEGORIES.find((c) => c.value === category),
    [category]
  );
  const columns = data?.columns || [];
  const rows = data?.rows || [];
  const reportMeta = data?.meta || null;

  function applyFilters() {
    setFilters({
      ...(draft.branchId ? { branchId: draft.branchId } : {}),
      ...(draft.dateFrom ? { dateFrom: draft.dateFrom } : {}),
      ...(draft.dateTo ? { dateTo: draft.dateTo } : {}),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 overflow-x-auto">
        {LOYALTY_REPORT_CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setCategory(c.value)}
            className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
              category === c.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(`loyalty.reports.categories.${c.value}`, c.label)}
            {c.fidelity === 'best-effort' && (
              <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                {t('loyalty.reports.bestEffort', 'best-effort')}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{t('loyalty.reports.filters.branch', 'Branch')}</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              placeholder={t('loyalty.reports.filters.branchPlaceholder', 'Branch id (blank = all)')}
              value={draft.branchId}
              onChange={(e) => setDraft({ ...draft, branchId: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{t('reports.filters.from', 'From')}</span>
            <input
              type="date"
              className="w-full rounded-md border bg-background px-3 py-2"
              value={draft.dateFrom}
              onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">{t('reports.filters.to', 'To')}</span>
            <input
              type="date"
              className="w-full rounded-md border bg-background px-3 py-2"
              value={draft.dateTo}
              onChange={(e) => setDraft({ ...draft, dateTo: e.target.value })}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={applyFilters}>
            {t('loyalty.reports.view', 'View')}
          </Button>
          <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {t('analytics.refresh', 'Refresh')}
          </Button>
          {canExport && (
            <Button type="button" variant="outline" onClick={() => setExportOpen(true)}>
              {t('loyalty.reports.export', 'Export')}
            </Button>
          )}
        </div>
      </div>

      {reportMeta?.note && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {reportMeta.note}
        </p>
      )}
      {reportMeta?.totalLiabilityInr != null && (
        <p className="text-sm font-medium">
          {t('loyalty.reports.totalLiability', 'Total outstanding liability: ₹{{amount}}', {
            amount: reportMeta.totalLiabilityInr,
          })}
        </p>
      )}
      {reportMeta?.upliftPercent != null && (
        <p className="text-sm font-medium">
          {t('loyalty.reports.uplift', 'Member vs non-member avg-spend difference: {{pct}}%', {
            pct: reportMeta.upliftPercent,
          })}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="border-t">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-muted-foreground">
                    {row[c.key] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && !isLoading && (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={columns.length || 1}>
                  {t('reports.reportViewer.noRows', 'No rows for this filter.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        reportType={category}
        filters={filters}
      />
    </div>
  );
}

export default LoyaltyReportsPanel;
