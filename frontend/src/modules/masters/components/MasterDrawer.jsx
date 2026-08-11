import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/cn';
import { MasterForm } from './MasterForm';
import { useMasterDependencies } from '../hooks/useMasters';
import { useAuditSearch } from '@/modules/audit/hooks/useAuditLog';

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit history' },
];

/**
 * Side drawer for a single master record — the searchable table (MasterCrudPage) opens this
 * on row click / Edit instead of navigating away or using a flat inline form.
 *
 * Built on the shared `Dialog` primitive with `variant="drawer"` (docks right, full height) —
 * there is no dedicated slide-in "Sheet" primitive in `components/ui` yet, so this adapts the
 * existing Dialog rather than introducing a brand-new one.
 */
export function MasterDrawer({
  open,
  onOpenChange,
  master, // null when creating
  config,
  categories,
  onSubmit,
  isSubmitting,
  mutations,
}) {
  const [tab, setTab] = useState('details');
  const [deactivateStep, setDeactivateStep] = useState('idle'); // idle | checking | confirm
  const [dependencyWarning, setDependencyWarning] = useState(null);
  const dependenciesCheck = useMasterDependencies(config.slug);

  const isEdit = Boolean(master);

  const auditParams = isEdit ? { resourceType: 'Master', resourceId: master.id, limit: 25 } : null;
  const { data: auditData, isLoading: auditLoading, error: auditError } = useAuditSearch(auditParams, {
    enabled: tab === 'audit' && isEdit,
  });
  const auditEntries = auditData?.entries || [];

  const close = () => {
    setTab('details');
    setDeactivateStep('idle');
    setDependencyWarning(null);
    onOpenChange(false);
  };

  const startDeactivate = async () => {
    setDeactivateStep('checking');
    try {
      const res = await dependenciesCheck.mutateAsync(master.id);
      const warning = res?.data?.warning || { activeReferences: 0 };
      setDependencyWarning(warning);
      if (warning.activeReferences > 0) {
        // Non-zero dependents — require a second explicit confirm click before proceeding
        // (mirrors the two-step confirm pattern in BranchLifecycleDialog).
        setDeactivateStep('confirm');
      } else {
        await commitDeactivate();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Dependency check failed');
      setDeactivateStep('idle');
    }
  };

  const commitDeactivate = async () => {
    try {
      await mutations.deactivate.mutateAsync(master.id);
      toast.success('Deactivated');
      setDeactivateStep('idle');
      setDependencyWarning(null);
      close();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to deactivate');
      setDeactivateStep('idle');
    }
  };

  const handleActivate = async () => {
    try {
      await mutations.activate.mutateAsync(master.id);
      toast.success('Activated');
      close();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to activate');
    }
  };

  return (
    <Dialog variant="drawer" open={open} onOpenChange={(v) => (v ? null : close())}>
      <DialogContent className="flex h-full max-h-none w-full flex-col overflow-y-auto rounded-none sm:rounded-l-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? master.name : `Create ${config.title.slice(0, -1)}`}
          </DialogTitle>
          <DialogDescription>Values are stored in MongoDB masters — not hardcoded.</DialogDescription>
        </DialogHeader>

        {isEdit && (
          <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Badge variant={master.isActive ? 'success' : 'warning'}>
                {master.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {master.isSystem && <Badge variant="outline">System</Badge>}
            </div>
            {!master.isSystem && (
              master.isActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startDeactivate}
                  disabled={deactivateStep === 'checking' || mutations.deactivate.isPending}
                >
                  {deactivateStep === 'checking' ? 'Checking…' : 'Deactivate'}
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleActivate} disabled={mutations.activate.isPending}>
                  Activate
                </Button>
              )
            )}
          </div>
        )}

        {deactivateStep === 'confirm' && dependencyWarning && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            <p className="font-medium">
              This will deactivate a record that {dependencyWarning.activeReferences} active
              {dependencyWarning.type === 'APPOINTMENTS_AND_PLANS' ? ' appointment(s)/treatment plan(s)' : ' record(s)'}{' '}
              still reference.
            </p>
            {dependencyWarning.breakdown && (
              <ul className="mt-1 list-disc pl-5">
                {typeof dependencyWarning.breakdown.appointments === 'number' && (
                  <li>{dependencyWarning.breakdown.appointments} active/upcoming appointments</li>
                )}
                {typeof dependencyWarning.breakdown.treatmentPlans === 'number' && (
                  <li>{dependencyWarning.breakdown.treatmentPlans} open treatment plans</li>
                )}
              </ul>
            )}
            <p className="mt-2 text-xs">Deactivating will not remove those references, but they will no longer be able to select this record for new bookings.</p>
            <div className="mt-3 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDeactivateStep('idle')}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={commitDeactivate} disabled={mutations.deactivate.isPending}>
                {mutations.deactivate.isPending ? 'Deactivating…' : 'Confirm deactivate'}
              </Button>
            </div>
          </div>
        )}

        {isEdit && (
          <div className="mb-4 flex gap-1 border-b">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'px-3 py-2 text-sm font-medium transition-colors',
                  tab === t.key
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {(!isEdit || tab === 'details') && (
          <MasterForm
            isService={config.isService}
            categories={categories}
            defaultValues={master || undefined}
            onCancel={close}
            isSubmitting={isSubmitting}
            onSubmit={onSubmit}
          />
        )}

        {isEdit && tab === 'audit' && (
          <div className="space-y-3">
            {auditLoading && <p className="text-sm text-muted-foreground">Loading history…</p>}
            {auditError && (
              <p className="text-sm text-destructive">
                {auditError.response?.data?.message || 'Could not load audit history.'}
              </p>
            )}
            {!auditLoading && auditEntries.length === 0 && (
              <p className="text-sm text-muted-foreground">No audit entries for this record yet.</p>
            )}
            <ul className="space-y-3">
              {auditEntries.map((entry) => (
                <li key={entry.id || entry._id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{entry.action}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Actor: {entry.actorId || entry.actorName || '—'}
                  </p>
                  {entry.metadata?.before && entry.metadata?.after && (
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="font-medium text-muted-foreground">Before</p>
                        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(entry.metadata.before, null, 2)}</pre>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">After</p>
                        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(entry.metadata.after, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default MasterDrawer;
