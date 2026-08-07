import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { EXPORT_FORMATS } from '../constants';
import { reportsApi } from '../api/reportsApi';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportDialog({ reportType, filters = {}, open, onClose }) {
  const { t } = useTranslation();
  const [format, setFormat] = useState('csv');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function handleExport() {
    setBusy(true);
    try {
      const { blob, filename } = await reportsApi.exportDownload(reportType, {
        ...filters,
        format,
      });
      downloadBlob(blob, filename);
      toast.success(
        format === 'pdf'
          ? t('reports.exportDialog.pdfPlaceholderDownloaded', 'PDF placeholder downloaded')
          : t('reports.exportDialog.exportReady', 'Export ready')
      );
      onClose?.();
    } catch (err) {
      toast.error(err.message || t('reports.exportDialog.exportFailed', 'Export failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-5 shadow-lg">
        <h2 className="font-display text-xl font-semibold">{t('reports.exportDialog.title', 'Export report')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('reports.exportDialog.downloadAs', 'Download {{reportType}} as CSV, Excel, or PDF placeholder.', {
            reportType,
          })}
        </p>
        <div className="mt-4 space-y-2">
          {EXPORT_FORMATS.map((f) => (
            <label key={f.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                checked={format === f.value}
                onChange={() => setFormat(f.value)}
              />
              {t(`reports.exportFormats.${f.value}`, f.label)}
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t('reports.exportDialog.cancel', 'Cancel')}
          </Button>
          <Button type="button" onClick={handleExport} disabled={busy}>
            {busy ? t('reports.exportDialog.exporting', 'Exporting…') : t('reports.exportDialog.export', 'Export')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ExportDialog;
