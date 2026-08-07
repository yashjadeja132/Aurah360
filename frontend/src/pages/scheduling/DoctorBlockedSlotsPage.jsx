import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { Skeleton } from '@/components/ui/skeleton';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useBlockedSlots, useSchedulingMutations } from '@/modules/scheduling/hooks/useScheduling';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

const REASONS = ['MEETING', 'EMERGENCY', 'MAINTENANCE', 'TRAINING', 'OTHER'];

export default function DoctorBlockedSlotsPage() {
  const { t } = useTranslation();
  const { data: doctorsData } = useDoctorList({ limit: 50, isActive: 'true' });
  const { data: branchesData } = useBranchList({ limit: 50 });
  const doctors = doctorsData?.items || [];
  const branches = branchesData?.items || [];
  const [doctorId, setDoctorId] = useState('');
  const activeDoctor = doctorId || doctors[0]?.id || '';
  const { data: blocked = [], isLoading } = useBlockedSlots({ doctorId: activeDoctor });
  const { createBlocked, deleteBlocked } = useSchedulingMutations();

  const [form, setForm] = useState({
    title: '',
    reason: 'MEETING',
    branchId: '',
    startAt: '',
    endAt: '',
    description: '',
  });

  const sorted = useMemo(
    () => [...blocked].sort((a, b) => new Date(a.startAt) - new Date(b.startAt)),
    [blocked]
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('scheduling.blocked.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('scheduling.blocked.subtitle')}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to={APP_ROUTES.SCHEDULING_VIEWER}>{t('scheduling.backToViewer')}</Link>
        </Button>
      </div>

      <Select value={activeDoctor} onChange={(e) => setDoctorId(e.target.value)}>
        <option value="">{t('scheduling.selectDoctor')}</option>
        {doctors.map((d) => (
          <option key={d.id} value={d.id}>
            {d.user?.fullName || d.doctorCode} ({d.doctorCode})
          </option>
        ))}
      </Select>

      <PermissionGuard permissions={[PERMISSIONS.SCHEDULE_EDIT, PERMISSIONS.SCHEDULE_ALL]}>
        <form
          className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!activeDoctor || !form.title || !form.startAt || !form.endAt) {
              toast.error(t('scheduling.blocked.validationRequired'));
              return;
            }
            try {
              await createBlocked.mutateAsync({
                doctorId: activeDoctor,
                branchId: form.branchId || null,
                title: form.title,
                reason: form.reason,
                startAt: new Date(form.startAt).toISOString(),
                endAt: new Date(form.endAt).toISOString(),
                description: form.description || null,
              });
              toast.success(t('scheduling.blocked.added'));
              setForm({
                title: '',
                reason: 'MEETING',
                branchId: '',
                startAt: '',
                endAt: '',
                description: '',
              });
            } catch (err) {
              toast.error(err?.response?.data?.message || t('scheduling.failed'));
            }
          }}
        >
          <Input
            placeholder={t('scheduling.blocked.titlePlaceholder')}
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />
          <Select value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}>
            {REASONS.map((r) => <option key={r} value={r}>{t(`scheduling.blocked.reasons.${r}`, r)}</option>)}
          </Select>
          <Select value={form.branchId} onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}>
            <option value="">{t('scheduling.allBranches')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
            ))}
          </Select>
          <Input
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))}
          />
          <Input
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => setForm((p) => ({ ...p, endAt: e.target.value }))}
          />
          <Button type="submit" disabled={createBlocked.isPending}>{t('scheduling.blocked.blockTime')}</Button>
        </form>
      </PermissionGuard>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !sorted.length ? (
        <EmptyState title={t('scheduling.blocked.emptyTitle')} description={t('scheduling.blocked.emptyDescription')} />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {sorted.map((b) => (
            <li key={b.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {b.title} <Badge className="ml-2" variant="warning">{t(`scheduling.blocked.reasons.${b.reason}`, b.reason)}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(b.startAt).toLocaleString()} → {new Date(b.endAt).toLocaleString()}
                </p>
              </div>
              <PermissionGuard permissions={[PERMISSIONS.SCHEDULE_EDIT, PERMISSIONS.SCHEDULE_ALL]}>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (!window.confirm(t('scheduling.blocked.confirmRemove'))) return;
                    await deleteBlocked.mutateAsync(b.id);
                    toast.success(t('scheduling.removed'));
                  }}
                >
                  {t('scheduling.remove')}
                </Button>
              </PermissionGuard>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
