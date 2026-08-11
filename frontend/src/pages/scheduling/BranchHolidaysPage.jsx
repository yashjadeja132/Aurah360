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
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useHolidays, useSchedulingMutations } from '@/modules/scheduling/hooks/useScheduling';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS, ROLES } from '@/constants/rbac';
import { useAuth } from '@/contexts/AuthContext';

// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES. A branch-scoped role (e.g.
// BRANCH_MANAGER, who holds holidays.*) manages holidays for their own branch only — the
// cross-branch picker is Owner/Admin-only.
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];

export default function BranchHolidaysPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const { data: branchesData } = useBranchList({ limit: 50 });
  const branches = branchesData?.items || [];
  const [branchId, setBranchId] = useState('');
  const activeBranch = isGlobalScope ? branchId || branches[0]?.id || '' : user?.branch || '';
  const { data: holidays = [], isLoading } = useHolidays(activeBranch);
  const { createHoliday, deleteHoliday } = useSchedulingMutations();

  const [form, setForm] = useState({
    holidayName: '',
    date: '',
    isRecurring: false,
    description: '',
  });

  const sorted = useMemo(
    () => [...holidays].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [holidays]
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('scheduling.holidays.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('scheduling.holidays.subtitle')}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to={APP_ROUTES.SCHEDULING_VIEWER}>{t('scheduling.backToViewer')}</Link>
        </Button>
      </div>

      {isGlobalScope ? (
        <Select value={activeBranch} onChange={(e) => setBranchId(e.target.value)}>
          <option value="">{t('scheduling.selectBranch')}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
          ))}
        </Select>
      ) : (
        <Input
          value={branches.find((b) => b.id === activeBranch)?.displayName || branches.find((b) => b.id === activeBranch)?.name || ''}
          disabled
          readOnly
        />
      )}

      <PermissionGuard permissions={[PERMISSIONS.HOLIDAYS_EDIT, PERMISSIONS.HOLIDAYS_ALL]}>
        <form
          className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!activeBranch || !form.holidayName || !form.date) {
              toast.error(t('scheduling.holidays.validationRequired'));
              return;
            }
            try {
              await createHoliday.mutateAsync({
                branchId: activeBranch,
                holidayName: form.holidayName,
                date: form.date,
                isRecurring: form.isRecurring,
                description: form.description || null,
              });
              toast.success(t('scheduling.holidays.added'));
              setForm({ holidayName: '', date: '', isRecurring: false, description: '' });
            } catch (err) {
              toast.error(err?.response?.data?.message || t('scheduling.failed'));
            }
          }}
        >
          <Input
            placeholder={t('scheduling.holidays.namePlaceholder')}
            value={form.holidayName}
            onChange={(e) => setForm((p) => ({ ...p, holidayName: e.target.value }))}
          />
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
          />
          <Input
            placeholder={t('scheduling.holidays.descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(e) => setForm((p) => ({ ...p, isRecurring: e.target.checked }))}
            />
            {t('scheduling.holidays.recurringYearly')}
          </label>
          <Button type="submit" disabled={createHoliday.isPending}>{t('scheduling.holidays.add')}</Button>
        </form>
      </PermissionGuard>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !sorted.length ? (
        <EmptyState title={t('scheduling.holidays.emptyTitle')} description={t('scheduling.holidays.emptyDescription')} />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {sorted.map((h) => (
            <li key={h.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {h.holidayName}
                  {h.isRecurring && <Badge className="ml-2" variant="secondary">{t('scheduling.holidays.yearly')}</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(h.date).toLocaleDateString()} · {h.description || '—'}
                </p>
              </div>
              <PermissionGuard permissions={[PERMISSIONS.HOLIDAYS_EDIT, PERMISSIONS.HOLIDAYS_ALL]}>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    if (!window.confirm(t('scheduling.holidays.confirmRemove'))) return;
                    await deleteHoliday.mutateAsync(h.id);
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
