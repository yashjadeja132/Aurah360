import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';
import { PharmacyOverviewPanel } from '@/modules/pharmacy/components/PharmacyOverviewPanel';
import { PrescriptionQueuePanel } from '@/modules/pharmacy/components/PrescriptionQueuePanel';

/**
 * Both /pharmacy and /pharmacy/queue were wrapped in the same
 * `PharmacyPermission` (pharmacy.view / pharmacy.*), so the two tabs share one
 * gate and there is no permission-conditional tab list here — carrying the
 * gates over verbatim means one gate, not two.
 */
const PHARMACY_PERMS = [PERMISSIONS.PHARMACY_VIEW, PERMISSIONS.PHARMACY_ALL];

export const PHARMACY_HUB_PERMISSIONS = PHARMACY_PERMS;

/**
 * Single Pharmacy screen: PharmacyDashboardPage + PrescriptionQueuePage as
 * tabs. DispenseScreenPage stays its own route (/pharmacy/dispenses/:id) — it
 * is a per-dispense workflow keyed by an id, a record and not a tab.
 * Tab lives in `?tab=` so a tab is deep-linkable.
 */
export default function PharmacyHubPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Queue first: the counter's main job is dispensing waiting prescriptions,
  // so it is the default tab when no ?tab= is present.
  const TABS = useMemo(
    () => [
      { id: 'queue', label: t('pharmacy.hub.tabs.queue', 'Prescription queue') },
      { id: 'overview', label: t('pharmacy.hub.tabs.overview', 'Overview') },
    ],
    [t]
  );

  const requested = searchParams.get('tab');
  const tab = TABS.some((tb) => tb.id === requested) ? requested : TABS[0]?.id;

  const setTab = (id, extra = {}) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    for (const [key, value] of Object.entries(extra)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <PermissionGuard permissions={PHARMACY_HUB_PERMISSIONS} fallback="redirect">
      <section className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('pharmacy.dashboard.title', 'Pharmacy')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('pharmacy.hub.subtitle', 'Dispensing overview and the prescription queue in one place')}
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b border-border pb-px">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              type="button"
              onClick={() => setTab(tb.id)}
              className={cn(
                'border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                tab === tb.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <PermissionGuard permissions={PHARMACY_PERMS}>
            <PharmacyOverviewPanel
              onOpenPrescription={(prescriptionId) => setTab('queue', { rx: prescriptionId })}
            />
          </PermissionGuard>
        )}
        {tab === 'queue' && (
          <PermissionGuard permissions={PHARMACY_PERMS}>
            <PrescriptionQueuePanel highlight={searchParams.get('rx')} />
          </PermissionGuard>
        )}
      </section>
    </PermissionGuard>
  );
}
