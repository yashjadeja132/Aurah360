import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { DoorOpen, Cpu, FlaskConical, Stethoscope } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useBranchDetail, useBranchMutations } from '@/modules/branches/hooks/useBranches';
import { BranchLifecycleDialog } from '@/modules/branches/components/BranchLifecycleDialog';
import { APP_ROUTES, branchEditPath, branchSettingsPath } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { RoomsTab, DevicesTab } from '@/pages/settings/ResourcesPage';
import { cn } from '@/utils/cn';

/**
 * §1.3 Resources tab — Rooms and Devices are re-housed here (same components the standalone
 * `/settings/resources` page uses, pinned to this branch) rather than rebuilt.
 *
 * Services and Treatment Protocols are deliberately NOT re-housed as branch-filtered lists:
 * - Services live on the `Master` model (SEC-030, see MasterController.js) which has no
 *   `branchId`/`branches` field at all and is documented as an intentionally org-wide catalogue
 *   — every branch books against the same service ids, so a branch filter would either return
 *   nothing or require a product change (a real per-branch applicability field + migration),
 *   which is out of scope here.
 * - Treatment Protocols are effective-dated, versioned masters by design (§1.3: "completed
 *   sessions keep the version they used") — they are meant to be shared org-wide, not owned by
 *   a branch.
 *
 * So both get a cross-link into their existing management pages instead of a half-wired branch
 * filter bolted onto global masters.
 */
function ResourcesTab({ branch }) {
  const { t } = useTranslation();
  const [sub, setSub] = useState('rooms');
  const SUBS = [
    { id: 'rooms', label: t('settings.resources.tabs.rooms', 'Rooms'), icon: DoorOpen },
    { id: 'devices', label: t('settings.resources.tabs.devices', 'Devices'), icon: Cpu },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.branches.detail.resourcesCard', 'Resources')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b pb-2">
          {SUBS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSub(s.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
                sub === s.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <s.icon className="h-4 w-4" /> {s.label}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/settings/services">
                <Stethoscope className="h-4 w-4" /> {t('settings.branches.detail.servicesLink', 'Services')}
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to={APP_ROUTES.TREATMENT_PROTOCOLS}>
                <FlaskConical className="h-4 w-4" /> {t('settings.branches.detail.protocolsLink', 'Treatment protocols')}
              </Link>
            </Button>
          </div>
        </div>
        {sub === 'rooms' && <RoomsTab branches={[branch]} branchId={branch.id} />}
        {sub === 'devices' && <DevicesTab branches={[branch]} branchId={branch.id} />}
      </CardContent>
    </Card>
  );
}

export default function BranchDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: branch, isLoading, isError } = useBranchDetail(id);
  const { remove } = useBranchMutations();
  const [lifecycleMode, setLifecycleMode] = useState(null); // 'deactivate' | 'transfer' | null

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
          <PermissionGuard permissions={[PERMISSIONS.BRANCHES_EDIT, PERMISSIONS.BRANCHES_MANAGE, PERMISSIONS.BRANCHES_ALL]}>
            {branch.isActive && (
              <Button variant="outline" onClick={() => setLifecycleMode('deactivate')}>
                {t('settings.branches.detail.deactivateAction', 'Deactivate')}
              </Button>
            )}
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.BRANCHES_MANAGE, PERMISSIONS.BRANCHES_ALL]}>
            {branch.isActive && (
              <Button variant="outline" onClick={() => setLifecycleMode('transfer')}>
                {t('settings.branches.detail.transferAction', 'Transfer')}
              </Button>
            )}
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.BRANCHES_DELETE, PERMISSIONS.BRANCHES_ALL]}>
            <Button variant="destructive" onClick={handleDelete}>{t('settings.branches.detail.deleteAction', 'Delete')}</Button>
          </PermissionGuard>
        </div>
      </div>

      <BranchLifecycleDialog
        branch={branch}
        mode={lifecycleMode}
        open={Boolean(lifecycleMode)}
        onOpenChange={(open) => {
          if (!open) setLifecycleMode(null);
        }}
      />

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

      <ResourcesTab branch={branch} />
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
