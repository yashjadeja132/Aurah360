import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { Skeleton } from '@/components/ui/skeleton';
import { useBranchList, useBranchMutations } from '@/modules/branches/hooks/useBranches';
import { BranchLifecycleDialog } from '@/modules/branches/components/BranchLifecycleDialog';
import { APP_ROUTES, branchDetailPath, branchEditPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

export default function BranchListPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: '',
    isActive: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const params = useMemo(() => {
    const p = { ...filters };
    if (!p.search) delete p.search;
    if (!p.isActive) delete p.isActive;
    return p;
  }, [filters]);

  const { data, isLoading, isError, error } = useBranchList(params);
  const mutations = useBranchMutations();
  const [lifecycle, setLifecycle] = useState(null); // { branch, mode: 'deactivate' | 'transfer' }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{t('settings.branches.list.title', 'Branches')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('settings.branches.list.description', 'Aurah 360 multi-branch configuration.')}
          </p>
        </div>
        <PermissionGuard permissions={[PERMISSIONS.BRANCHES_CREATE, PERMISSIONS.BRANCHES_ALL]}>
          <Button asChild>
            <Link to={APP_ROUTES.BRANCH_CREATE}>
              <Plus className="h-4 w-4" />
              {t('settings.branches.list.addAction', 'Add branch')}
            </Link>
          </Button>
        </PermissionGuard>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder={t('settings.branches.list.searchPlaceholder', 'Search branches…')}
          value={filters.search}
          onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value, page: 1 }))}
        />
        <Select
          value={filters.isActive}
          onChange={(e) => setFilters((p) => ({ ...p, isActive: e.target.value, page: 1 }))}
        >
          <option value="">{t('settings.branches.list.allStatuses', 'All statuses')}</option>
          <option value="true">{t('settings.branches.list.active', 'Active')}</option>
          <option value="false">{t('settings.branches.list.inactive', 'Inactive')}</option>
        </Select>
        <Select
          value={filters.sortBy}
          onChange={(e) => setFilters((p) => ({ ...p, sortBy: e.target.value }))}
        >
          <option value="createdAt">{t('settings.branches.list.sort.newest', 'Newest')}</option>
          <option value="name">{t('settings.branches.list.sort.name', 'Name')}</option>
          <option value="branchCode">{t('settings.branches.list.sort.code', 'Code')}</option>
          <option value="city">{t('settings.branches.list.sort.city', 'City')}</option>
        </Select>
      </div>

      {isError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error?.response?.data?.message || t('settings.branches.list.loadError', 'Failed to load branches')}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !(data?.items || []).length ? (
        <EmptyState title={t('settings.branches.list.emptyTitle', 'No branches')} description={t('settings.branches.list.emptyDescription', 'Create the first Aurah 360 branch.')} />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('settings.branches.list.table.branch', 'Branch')}</TableHead>
                <TableHead>{t('settings.branches.list.table.code', 'Code')}</TableHead>
                <TableHead>{t('settings.branches.list.table.city', 'City')}</TableHead>
                <TableHead>{t('settings.branches.list.table.status', 'Status')}</TableHead>
                <TableHead className="text-right">{t('settings.branches.list.table.actions', 'Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell>
                    <p className="font-medium">{branch.displayName}</p>
                    <p className="text-xs text-muted-foreground">{branch.email}</p>
                  </TableCell>
                  <TableCell>{branch.branchCode}</TableCell>
                  <TableCell>{branch.city || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={branch.isActive ? 'success' : 'warning'}>
                      {branch.isActive ? t('settings.branches.list.active', 'Active') : t('settings.branches.list.inactive', 'Inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to={branchDetailPath(branch.id)}>{t('settings.branches.list.viewAction', 'View')}</Link>
                      </Button>
                      <PermissionGuard permissions={[PERMISSIONS.BRANCHES_EDIT, PERMISSIONS.BRANCHES_ALL]}>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={branchEditPath(branch.id)}>{t('settings.branches.list.editAction', 'Edit')}</Link>
                        </Button>
                        {branch.isActive ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setLifecycle({ branch, mode: 'deactivate' })}
                            >
                              {t('settings.branches.list.deactivateAction', 'Deactivate')}
                            </Button>
                            <PermissionGuard permissions={[PERMISSIONS.BRANCHES_MANAGE, PERMISSIONS.BRANCHES_ALL]}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLifecycle({ branch, mode: 'transfer' })}
                              >
                                {t('settings.branches.list.transferAction', 'Transfer')}
                              </Button>
                            </PermissionGuard>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              mutations.activate.mutateAsync(branch.id)
                                .then(() => toast.success(t('settings.branches.list.activatedToast', 'Activated')))
                                .catch((e) => toast.error(e.response?.data?.message || t('settings.branches.list.failedToast', 'Failed')))
                            }
                          >
                            {t('settings.branches.list.activateAction', 'Activate')}
                          </Button>
                        )}
                      </PermissionGuard>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination meta={data?.meta} onPageChange={(page) => setFilters((p) => ({ ...p, page }))} />

      {lifecycle && (
        <BranchLifecycleDialog
          branch={lifecycle.branch}
          mode={lifecycle.mode}
          open={Boolean(lifecycle)}
          onOpenChange={(v) => { if (!v) setLifecycle(null); }}
        />
      )}
    </section>
  );
}
