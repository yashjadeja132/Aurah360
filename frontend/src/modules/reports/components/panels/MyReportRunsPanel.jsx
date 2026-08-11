import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useReportRuns } from '@/modules/reports/hooks/useReports';
import { reportsApi } from '@/modules/reports/api/reportsApi';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_LABEL = {
  QUEUED: 'reports.runs.status.queued',
  RUNNING: 'reports.runs.status.running',
  COMPLETED: 'reports.runs.status.completed',
  FAILED: 'reports.runs.status.failed',
};

/**
 * "My report runs" status page — lists the async report jobs queued via
 * `POST /reports/export/:type/queue` (ReportService#queueHeavyReport) for the current user,
 * with a Download button once a run is COMPLETED and not past its `expiresAt` (spec: "large
 * reports run async with expiry-limited download"). Same list/download API is used by the
 * "Reports" tab's route and this workspace tab — see `pages/reports/MyReportRunsPage.jsx`.
 */
export function MyReportRunsPanel() {
  const { t } = useTranslation();
  const { data: runs = [], isLoading, refetch } = useReportRuns();
  const [downloadingId, setDownloadingId] = useState(null);

  async function handleDownload(run) {
    setDownloadingId(run.id);
    try {
      const { blob, filename } = await reportsApi.downloadRun(run.id);
      downloadBlob(blob, filename);
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err.message || t('reports.runs.downloadFailed', 'Download failed')
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t(
            'reports.runs.subtitle',
            'Large reports run in the background — check status here and download once ready.'
          )}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>
          {t('reports.runs.refresh', 'Refresh')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2">{t('reports.runs.table.type', 'Report')}</th>
              <th className="px-3 py-2">{t('reports.runs.table.format', 'Format')}</th>
              <th className="px-3 py-2">{t('reports.runs.table.status', 'Status')}</th>
              <th className="px-3 py-2">{t('reports.runs.table.requestedAt', 'Requested')}</th>
              <th className="px-3 py-2">{t('reports.runs.table.expiresAt', 'Expires')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const canDownload = run.status === 'COMPLETED' && run.hasExport && !run.isExpired;
              return (
                <tr key={run.id} className="border-t">
                  <td className="px-3 py-2">{run.reportType}</td>
                  <td className="px-3 py-2 text-muted-foreground uppercase">{run.format}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {run.isExpired && run.status === 'COMPLETED'
                      ? t('reports.runs.status.expired', 'Expired')
                      : t(STATUS_LABEL[run.status] || run.status, run.status)}
                    {run.status === 'FAILED' && run.failedReason ? (
                      <span className="ml-1 text-xs text-destructive">({run.failedReason})</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {run.requestedAt ? new Date(run.requestedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {run.expiresAt ? new Date(run.expiresAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canDownload || downloadingId === run.id}
                      onClick={() => handleDownload(run)}
                    >
                      {downloadingId === run.id
                        ? t('reports.runs.downloading', 'Downloading…')
                        : t('reports.runs.download', 'Download')}
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!runs.length && !isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                  {t('reports.runs.empty', 'No report runs yet.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MyReportRunsPanel;
