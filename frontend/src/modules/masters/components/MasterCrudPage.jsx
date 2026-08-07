import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/rbac';
import { MasterForm } from './MasterForm';
import { useMasterActive, useMasterList, useMasterMutations } from '../hooks/useMasters';

/**
 * Reusable master CRUD page — driven by MASTER_CONFIGS.
 */
export function MasterCrudPage({ config }) {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    search: '',
    isActive: '',
    sortBy: 'sortOrder',
    sortOrder: 'asc',
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const queryParams = useMemo(() => {
    const params = { ...filters };
    if (!params.search) delete params.search;
    if (!params.isActive) delete params.isActive;
    return params;
  }, [filters]);

  const { data, isLoading, isError, error } = useMasterList(config.slug, queryParams);
  const { data: categories = [] } = useMasterActive('service-categories', Boolean(config.isService));
  const mutations = useMasterMutations(config.slug);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        code: values.code || null,
        description: values.description || null,
        color: values.color || null,
      };
      if (config.isService) {
        payload.categoryId = values.categoryId || null;
        payload.durationMinutes = Number(values.durationMinutes) || 30;
        payload.price = Number(values.price) || 0;
      } else {
        delete payload.categoryId;
        delete payload.durationMinutes;
        delete payload.price;
      }

      if (editing) {
        await mutations.update.mutateAsync({ id: editing.id, payload });
        toast.success('Updated');
      } else {
        await mutations.create.mutateAsync(payload);
        toast.success('Created');
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return;
    try {
      await mutations.remove.mutateAsync(row.id);
      toast.success('Deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">{config.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{config.description}</p>
        </div>
        <PermissionGuard permissions={[PERMISSIONS.MASTERS_CREATE, PERMISSIONS.MASTERS_ALL]}>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </PermissionGuard>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Search…"
          value={filters.search}
          onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value, page: 1 }))}
        />
        <Select
          value={filters.isActive}
          onChange={(e) => setFilters((p) => ({ ...p, isActive: e.target.value, page: 1 }))}
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
        <Select
          value={filters.sortBy}
          onChange={(e) => setFilters((p) => ({ ...p, sortBy: e.target.value }))}
        >
          <option value="sortOrder">Sort order</option>
          <option value="name">Name</option>
          <option value="createdAt">Newest</option>
        </Select>
      </div>

      {isError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error?.response?.data?.message || 'Failed to load'}
        </p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !(data?.items || []).length ? (
        <EmptyState title="No records" description="Create the first master record." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {config.columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row) => (
                <TableRow key={row.id}>
                  {config.columns.map((col) => (
                    <TableCell key={col.key}>
                      {col.key === 'color' && row.color ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ background: row.color }} />
                          {row.color}
                        </span>
                      ) : (
                        row[col.key] ?? '—'
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Badge variant={row.isActive ? 'success' : 'warning'}>
                      {row.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <PermissionGuard permissions={[PERMISSIONS.MASTERS_EDIT, PERMISSIONS.MASTERS_ALL]}>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>Edit</Button>
                        {row.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => mutations.deactivate.mutateAsync(row.id).then(() => toast.success('Deactivated')).catch((e) => toast.error(e.response?.data?.message || 'Failed'))}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => mutations.activate.mutateAsync(row.id).then(() => toast.success('Activated')).catch((e) => toast.error(e.response?.data?.message || 'Failed'))}
                          >
                            Activate
                          </Button>
                        )}
                      </PermissionGuard>
                      <PermissionGuard permissions={[PERMISSIONS.MASTERS_DELETE, PERMISSIONS.MASTERS_ALL]}>
                        {!row.isSystem && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(row)}>Delete</Button>
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

      <Pagination
        meta={data?.meta}
        onPageChange={(page) => setFilters((p) => ({ ...p, page }))}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} {config.title.slice(0, -1)}</DialogTitle>
            <DialogDescription>Values are stored in MongoDB masters — not hardcoded.</DialogDescription>
          </DialogHeader>
          <MasterForm
            isService={config.isService}
            categories={categories}
            defaultValues={editing || undefined}
            onCancel={() => setDialogOpen(false)}
            isSubmitting={mutations.create.isPending || mutations.update.isPending}
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default MasterCrudPage;
