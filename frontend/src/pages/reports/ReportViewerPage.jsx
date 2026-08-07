import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { APP_ROUTES } from '@/constants/routes';
import { useReportGenerate } from '@/modules/reports/hooks/useReports';
import { ReportFilters } from '@/modules/reports/components/ReportFilters';
import { ExportDialog } from '@/modules/reports/components/ExportDialog';
import { REPORT_TYPES } from '@/modules/reports/constants';
import { useAuth } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/constants/rbac';
import { hasAnyPermission } from '@/utils/permissions';

export default function ReportViewerPage() {
  const { t } = useTranslation();
  const { type } = useParams();
  const meta = REPORT_TYPES.find((r) => r.value === type);
  const { user } = useAuth();
  const canExport = hasAnyPermission(user?.permissions, [
    PERMISSIONS.REPORTS_EXPORT,
    PERMISSIONS.REPORTS_ALL,
  ]);
  const [draft, setDraft] = useState({});
  const [filters, setFilters] = useState({});
  const [exportOpen, setExportOpen] = useState(false);
  const { data, isLoading, refetch, isFetching } = useReportGenerate(type, filters);

  if (!meta) return <p className="text-sm text-muted-foreground">{t('reports.unknownReport', 'Unknown report.')}</p>;

  const label = t(`reports.reportTypes.${meta.value}`, meta.label);
  const columns = data?.columns || [];
  const rows = data?.rows || [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{label}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading
              ? t('analytics.loading', 'Loading…')
              : t('reports.reportViewer.rowCount', '{{count}} rows', { count: data?.rowCount ?? 0 })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.REPORTS}>{t('reports.hub', 'Hub')}</Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            {t('analytics.refresh', 'Refresh')}
          </Button>
          {canExport && (
            <Button type="button" onClick={() => setExportOpen(true)}>
              {t('reports.reportViewer.export', 'Export')}
            </Button>
          )}
        </div>
      </div>

      <ReportFilters value={draft} onChange={setDraft} onApply={() => setFilters({ ...draft })} />

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
        reportType={type}
        filters={filters}
      />
    </section>
  );
}
