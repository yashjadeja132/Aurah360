import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StaffTable } from '@/modules/users/components/StaffTable';
import { StaffFilters } from '@/modules/users/components/StaffFilters';
import { OpenWorkReassignDialog } from '@/modules/users/components/OpenWorkReassignDialog';
import { Pagination } from '@/components/common/Pagination';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useStaffList, useStaffActions } from '@/modules/users/hooks/useStaff';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

export default function StaffListPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const queryParams = useMemo(() => {
    const params = { ...filters };
    if (!params.search) delete params.search;
    if (!params.role) delete params.role;
    if (!params.isActive) delete params.isActive;
    return params;
  }, [filters]);

  const { data, isLoading, isError, error } = useStaffList(queryParams);
  const actions = useStaffActions();
  const [reassignState, setReassignState] = useState(null); // { user, openWork } | null

  const handleActivate = async (user) => {
    try {
      await actions.activate.mutateAsync(user.id);
      toast.success(t('users.list.activateSuccess', { name: user.fullName }));
    } catch (err) {
      toast.error(err.response?.data?.message || t('users.list.activateFailed'));
    }
  };

  const handleDeactivate = async (user) => {
    try {
      await actions.deactivate.mutateAsync({ id: user.id });
      toast.success(t('users.list.deactivateSuccess', { name: user.fullName }));
    } catch (err) {
      // §Admin offboarding — deactivation blocked because the staff member still owns open
      // recall/CRM follow-up work; collect a reassignment target before retrying.
      if (err.response?.data?.code === 'OPEN_WORK_REASSIGNMENT_REQUIRED') {
        setReassignState({ user, openWork: err.response.data.errors?.openWork });
        return;
      }
      toast.error(err.response?.data?.message || t('users.list.deactivateFailed'));
    }
  };

  const handleConfirmReassign = async (reassignToUserId) => {
    if (!reassignState) return;
    try {
      await actions.deactivate.mutateAsync({ id: reassignState.user.id, reassignToUserId });
      toast.success(t('users.list.deactivateSuccess', { name: reassignState.user.fullName }));
      setReassignState(null);
    } catch (err) {
      toast.error(err.response?.data?.message || t('users.list.deactivateFailed'));
    }
  };

  // Full active-staff pool for the reassignment picker — independent of the (paginated,
  // filtered) list query above, so a candidate on another page/filter is still selectable.
  const { data: candidatePool } = useStaffList({ page: 1, limit: 200, isActive: 'true' });
  const reassignCandidates = reassignState
    ? (candidatePool?.items || []).filter((u) => u.id !== reassignState.user.id)
    : [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('users.list.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('users.list.subtitle')}
          </p>
        </div>
        <PermissionGuard permissions={[PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_ALL]}>
          <Button asChild>
            <Link to={APP_ROUTES.STAFF_CREATE}>
              <Plus className="h-4 w-4" />
              {t('users.list.addStaff')}
            </Link>
          </Button>
        </PermissionGuard>
      </div>

      <StaffFilters filters={filters} onChange={setFilters} />

      {isError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error?.response?.data?.message || t('users.list.loadFailed')}
        </p>
      )}

      <StaffTable
        items={data?.items || []}
        isLoading={isLoading}
        onActivate={handleActivate}
        onDeactivate={handleDeactivate}
      />

      <Pagination
        meta={data?.meta}
        onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
      />

      <OpenWorkReassignDialog
        open={Boolean(reassignState)}
        onOpenChange={(next) => !next && setReassignState(null)}
        openWork={reassignState?.openWork}
        candidates={reassignCandidates}
        isSubmitting={actions.deactivate.isPending}
        onConfirm={handleConfirmReassign}
      />
    </section>
  );
}
