import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { analyticsApi } from '../api/analyticsApi';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButtons({ category, filters = {} }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(null);

  async function run(format) {
    setBusy(format);
    try {
      const { blob, filename } = await analyticsApi.exportDownload(category, {
        ...filters,
        format,
      });
      download(blob, filename);
      toast.success(
        format === 'pdf'
          ? t('analytics.export.pdfPlaceholderDownloaded', 'PDF placeholder downloaded')
          : t('analytics.export.exportReady', 'Export ready')
      );
    } catch (err) {
      toast.error(err?.response?.data?.message || t('analytics.export.exportFailed', 'Export failed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {['csv', 'excel', 'pdf'].map((f) => (
        <Button
          key={f}
          type="button"
          size="sm"
          variant="outline"
          disabled={Boolean(busy)}
          onClick={() => run(f)}
        >
          {busy === f ? '…' : f.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
