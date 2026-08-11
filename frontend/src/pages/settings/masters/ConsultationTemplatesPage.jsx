import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { Skeleton } from '@/components/ui/skeleton';
import { PERMISSIONS } from '@/constants/rbac';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import {
  useConsultationTemplatesAdmin,
  useConsultationTemplateAdminMutations,
} from '@/modules/consultations/hooks/useConsultationTemplatesAdmin';

const TEMPLATE_TYPES = ['SOAP', 'DIAGNOSIS', 'EXAMINATION', 'QUICK_PHRASE'];

/**
 * Settings → Masters — "Consultation templates (versioned, medical-lead approved)".
 * `consultationsApi.listTemplates/createTemplate` were previously only ever consumed inline
 * during a live consultation session (doctor-scoped picker). This is the standalone admin
 * surface: browse/search the whole library, create/edit, and approve a version — gated to
 * CONSULTATION_TEMPLATE_MANAGE (owner/admin/doctor by seed), not the broader consultation.* set.
 */
export default function ConsultationTemplatesPage() {
  const [filters, setFilters] = useState({ page: 1, limit: 10, search: '', templateType: '', status: '' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const queryParams = useMemo(() => {
    const params = { ...filters };
    if (!params.search) delete params.search;
    if (!params.templateType) delete params.templateType;
    if (!params.status) delete params.status;
    return params;
  }, [filters]);

  const { data, isLoading, isError, error } = useConsultationTemplatesAdmin(queryParams);
  const { data: doctorData } = useDoctorList({ limit: 100 });
  const doctors = doctorData?.items || [];
  const mutations = useConsultationTemplateAdminMutations();

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
      let content = {};
      if (values.contentText?.trim()) {
        try {
          content = JSON.parse(values.contentText);
        } catch {
          content = { text: values.contentText };
        }
      }
      const payload = {
        name: values.name,
        templateType: values.templateType,
        doctorId: values.doctorId,
        isShared: values.isShared,
        content,
      };

      if (editing) {
        delete payload.doctorId; // not editable — the template's authoring doctor is fixed
        await mutations.update.mutateAsync({ id: editing.id, payload });
        toast.success('Template updated');
      } else {
        await mutations.create.mutateAsync(payload);
        toast.success('Template created');
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

  const handleApprove = async (row) => {
    try {
      await mutations.approve.mutateAsync(row.id);
      toast.success('Template approved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approve failed');
    }
  };

  const items = data?.items || [];

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">Consultation Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Versioned SOAP / diagnosis / examination / quick-phrase templates. Editing an approved
            template starts a new version — it must be re-approved before it is trusted again.
          </p>
        </div>
        <PermissionGuard permissions={[PERMISSIONS.CONSULTATION_TEMPLATE_MANAGE]}>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </PermissionGuard>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder="Search by name…"
          value={filters.search}
          onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value, page: 1 }))}
        />
        <Select
          value={filters.templateType}
          onChange={(e) => setFilters((p) => ({ ...p, templateType: e.target.value, page: 1 }))}
        >
          <option value="">All types</option>
          {TEMPLATE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
        <Select
          value={filters.status}
          onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value, page: 1 }))}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="APPROVED">Approved</option>
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
      ) : !items.length ? (
        <EmptyState title="No templates" description="Create the first consultation template." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Shared</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.templateType}</TableCell>
                  <TableCell>v{row.version}</TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'APPROVED' ? 'success' : 'warning'}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.isShared ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <PermissionGuard permissions={[PERMISSIONS.CONSULTATION_TEMPLATE_MANAGE]}>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>Edit</Button>
                        {row.status !== 'APPROVED' && (
                          <Button variant="ghost" size="sm" onClick={() => handleApprove(row)}>
                            <CheckCircle2 className="h-4 w-4" /> Approve
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(row)}>Delete</Button>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit' : 'Create'} Template</DialogTitle>
            <DialogDescription>
              {editing?.status === 'APPROVED'
                ? 'This template is approved — saving creates a new draft version.'
                : 'Content may be plain text (a quick phrase) or JSON (structured SOAP sections).'}
            </DialogDescription>
          </DialogHeader>
          <TemplateForm
            defaultValues={editing || undefined}
            doctors={doctors}
            onCancel={() => setDialogOpen(false)}
            isSubmitting={mutations.create.isPending || mutations.update.isPending}
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

function TemplateForm({ defaultValues, doctors, onSubmit, onCancel, isSubmitting }) {
  const [values, setValues] = useState({
    name: defaultValues?.name || '',
    templateType: defaultValues?.templateType || TEMPLATE_TYPES[0],
    doctorId: defaultValues?.doctorId || '',
    isShared: defaultValues?.isShared ?? true,
    contentText: defaultValues?.content ? JSON.stringify(defaultValues.content, null, 2) : '',
  });
  const isEditing = Boolean(defaultValues);

  const handleChange = (key) => (e) =>
    setValues((v) => ({ ...v, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="space-y-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" required value={values.name} onChange={handleChange('name')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="templateType">Type</Label>
          <Select id="templateType" value={values.templateType} onChange={handleChange('templateType')}>
            {TEMPLATE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </div>
      </div>

      {!isEditing && (
        <div className="space-y-2">
          <Label htmlFor="doctorId">Authoring doctor</Label>
          <Select id="doctorId" required value={values.doctorId} onChange={handleChange('doctorId')}>
            <option value="">Select doctor</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name || d.fullName || d.id}</option>
            ))}
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="contentText">Content (plain text or JSON)</Label>
        <textarea
          id="contentText"
          rows={6}
          value={values.contentText}
          onChange={handleChange('contentText')}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={values.isShared} onChange={handleChange('isShared')} />
        Shared with all doctors
      </label>

      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
