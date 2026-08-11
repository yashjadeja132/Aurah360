import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { StepUpModal } from '@/modules/auth/components/StepUpModal';
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

// SEC-002 — exportDownload uses responseType: 'blob', so an error response (including the
// STEP_UP_REQUIRED 403) still arrives as a Blob rather than parsed JSON. Read it back out to
// find the error code.
async function readErrorCode(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      return JSON.parse(text)?.code;
    } catch {
      return undefined;
    }
  }
  return data?.code;
}

export function ExportDialog({ reportType, filters = {}, open, onClose }) {
  const { t } = useTranslation();
  const [format, setFormat] = useState('csv');
  const [busy, setBusy] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);

  if (!open) return null;

  async function runExport(stepUpToken) {
    setBusy(true);
    try {
      const { blob, filename } = await reportsApi.exportDownload(
        reportType,
        { ...filters, format },
        stepUpToken
      );
      downloadBlob(blob, filename);
      toast.success(
        format === 'pdf'
          ? t('reports.exportDialog.pdfPlaceholderDownloaded', 'PDF placeholder downloaded')
          : t('reports.exportDialog.exportReady', 'Export ready')
      );
      onClose?.();
    } catch (err) {
      // SEC-002 — sensitive exports require a fresh step-up token; prompt for one and retry.
      const code = await readErrorCode(err);
      if (code === 'STEP_UP_REQUIRED') {
        setStepUpOpen(true);
        return;
      }
      toast.error(err.message || t('reports.exportDialog.exportFailed', 'Export failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    await runExport();
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

      <StepUpModal
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        title={t('reports.exportDialog.stepUpTitle', 'Confirm export')}
        description={t(
          'reports.exportDialog.stepUpDescription',
          'This report may contain sensitive patient or financial data. Re-authenticate to continue.'
        )}
        onVerified={(stepUpToken) => runExport(stepUpToken)}
      />
    </div>
  );
}

export default ExportDialog;
