import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { APP_ROUTES } from '@/constants/routes';
import {
  useCreateScheduledReport,
  useDeleteScheduledReport,
  useScheduledReports,
} from '@/modules/reports/hooks/useReports';
import { REPORT_TYPES, SCHEDULE_FREQUENCIES, EXPORT_FORMATS } from '@/modules/reports/constants';
import { useAuth } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/constants/rbac';
import { hasAnyPermission } from '@/utils/permissions';

export default function ScheduledReportsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canSchedule = hasAnyPermission(user?.permissions, [
    PERMISSIONS.REPORTS_SCHEDULE,
    PERMISSIONS.REPORTS_ALL,
  ]);
  const { data: items = [], isLoading } = useScheduledReports();
  const create = useCreateScheduledReport();
  const remove = useDeleteScheduledReport();
  const [form, setForm] = useState({
    name: '',
    reportType: 'revenue',
    frequency: 'DAILY',
    format: 'csv',
  });

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await create.mutateAsync(form);
      toast.success(t('reports.scheduled.createSuccess', 'Scheduled report created'));
      setForm((f) => ({ ...f, name: '' }));
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || t('reports.scheduled.createFailed', 'Create failed'));
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('reports.scheduled.title', 'Scheduled reports')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('reports.scheduled.subtitle', 'BullMQ runs daily, weekly, and monthly sweeps.')}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={APP_ROUTES.REPORTS}>{t('reports.hub', 'Hub')}</Link>
        </Button>
      </div>

      {canSchedule && (
        <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
          <input
            required
            placeholder={t('reports.scheduled.namePlaceholder', 'Name')}
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={form.reportType}
            onChange={(e) => setForm({ ...form, reportType: e.target.value })}
          >
            {REPORT_TYPES.map((r) => (
              <option key={r.value} value={r.value}>
                {t(`reports.reportTypes.${r.value}`, r.label)}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={form.frequency}
            onChange={(e) => setForm({ ...form, frequency: e.target.value })}
          >
            {SCHEDULE_FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {t(`reports.scheduleFrequencies.${f.value}`, f.label)}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={form.format}
            onChange={(e) => setForm({ ...form, format: e.target.value })}
          >
            {EXPORT_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {t(`reports.exportFormats.${f.value}`, f.label)}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={create.isPending}>
            {t('reports.scheduled.schedule', 'Schedule')}
          </Button>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2">{t('reports.scheduled.table.name', 'Name')}</th>
              <th className="px-3 py-2">{t('reports.scheduled.table.type', 'Type')}</th>
              <th className="px-3 py-2">{t('reports.scheduled.table.frequency', 'Frequency')}</th>
              <th className="px-3 py-2">{t('reports.scheduled.table.nextRun', 'Next run')}</th>
              <th className="px-3 py-2">{t('reports.scheduled.table.status', 'Status')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(items || []).map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.reportType}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.frequency}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {s.nextRunAt ? new Date(s.nextRunAt).toLocaleString() : '—'}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {s.isActive ? s.lastRunStatus || t('reports.scheduled.active', 'Active') : t('reports.scheduled.inactive', 'Inactive')}
                </td>
                <td className="px-3 py-2 text-right">
                  {canSchedule && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await remove.mutateAsync(s.id);
                          toast.success(t('reports.scheduled.removed', 'Removed'));
                        } catch (err) {
                          toast.error(err.message || t('reports.scheduled.deleteFailed', 'Delete failed'));
                        }
                      }}
                    >
                      {t('reports.scheduled.delete', 'Delete')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!items?.length && !isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                  {t('reports.scheduled.noScheduledReports', 'No scheduled reports yet.')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
