import { Link, useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useBranchDetail, useBranchMutations } from '@/modules/branches/hooks/useBranches';
import { APP_ROUTES, branchEditPath, branchSettingsPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

export default function BranchDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: branch, isLoading, isError } = useBranchDetail(id);
  const { remove } = useBranchMutations();

  const handleDelete = async () => {
    if (!window.confirm(t('settings.branches.detail.confirmDelete', 'Soft-delete this branch?'))) return;
    try {
      await remove.mutateAsync(id);
      toast.success(t('settings.branches.detail.deletedToast', 'Branch deleted'));
      navigate(APP_ROUTES.BRANCHES);
    } catch (err) {
      toast.error(err.response?.data?.message || t('settings.branches.detail.deleteErrorToast', 'Delete failed'));
    }
  };

  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (isError || !branch) return <p className="text-destructive">{t('settings.branches.detail.notFound', 'Branch not found.')}</p>;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to={APP_ROUTES.BRANCHES}>← {t('settings.branches.detail.backLink', 'Branches')}</Link>
          </Button>
          <h1 className="font-display text-3xl font-semibold text-primary">{branch.displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{branch.branchCode} · {branch.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionGuard permissions={[PERMISSIONS.BRANCHES_EDIT, PERMISSIONS.BRANCHES_ALL]}>
            <Button asChild variant="outline"><Link to={branchEditPath(id)}>{t('settings.branches.detail.editAction', 'Edit')}</Link></Button>
            <Button asChild variant="outline"><Link to={branchSettingsPath(id)}>{t('settings.branches.detail.settingsAction', 'Settings')}</Link></Button>
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.BRANCHES_DELETE, PERMISSIONS.BRANCHES_ALL]}>
            <Button variant="destructive" onClick={handleDelete}>{t('settings.branches.detail.deleteAction', 'Delete')}</Button>
          </PermissionGuard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('settings.branches.detail.profileCard', 'Profile')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={t('settings.branches.detail.fields.status', 'Status')} value={<Badge variant={branch.isActive ? 'success' : 'warning'}>{branch.status}</Badge>} />
            <Row label={t('settings.branches.detail.fields.phone', 'Phone')} value={branch.phone} />
            <Row label={t('settings.branches.detail.fields.city', 'City')} value={branch.city || '—'} />
            <Row label={t('settings.branches.detail.fields.timezone', 'Timezone')} value={branch.timezone} />
            <Row label={t('settings.branches.detail.fields.currency', 'Currency')} value={branch.currency} />
            <Row label={t('settings.branches.detail.fields.workingHours', 'Working hours')} value={branch.workingHours || '—'} />
            <Row label={t('settings.branches.detail.fields.address', 'Address')} value={branch.address || '—'} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('settings.branches.detail.operationsCard', 'Operations settings')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={t('settings.branches.detail.fields.slotDuration', 'Slot duration')} value={`${branch.settings?.timeSlotDurationMinutes ?? 15} min`} />
            <Row label={t('settings.branches.detail.fields.buffer', 'Buffer')} value={`${branch.settings?.appointmentBufferMinutes ?? 5} min`} />
            <Row label={t('settings.branches.detail.fields.workingDays', 'Working days')} value={(branch.settings?.workingDays || []).join(', ') || '—'} />
            <Row
              label={t('settings.branches.detail.fields.emergency', 'Emergency')}
              value={branch.settings?.emergencyContact?.phone || '—'}
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
