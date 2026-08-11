import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissions';
import { SessionQueuePanel } from '@/modules/treatmentSessions/components/SessionQueuePanel';
import { TreatmentPlanListPanel } from '@/modules/treatmentPlans/components/TreatmentPlanListPanel';
import { ProtocolLibraryPanel } from '@/modules/treatmentPlans/components/ProtocolLibraryPanel';
import { PackageBuilderPanel } from '@/modules/treatmentPlans/components/PackageBuilderPanel';
import { AdverseEventRegisterPanel } from '@/modules/treatmentSafety/components/AdverseEventRegisterPanel';
import { PatchTestPanel } from '@/modules/treatmentSafety/components/PatchTestPanel';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { cn } from '@/utils/cn';

/**
 * One Treatments screen. Replaces the ~7 sibling top-level treatment routes
 * (`TreatmentDashboardPage`, `SessionListPage`, `TreatmentPlanListPage`, `ProtocolLibraryPage`,
 * `PackageBuilderPage`, `TreatmentSafetyPage`) with client-side tabs — same TABS-array +
 * guarded-render pattern as `PatientDetailPage`, so switching areas is a state change, not a
 * navigation.
 *
 * Deliberately NOT tabs (they stay their own routes, they are records/workflows not views):
 *   - the treatment plan BUILDER wizard  (`/treatment-plans/:id`)
 *   - the SESSION EXECUTION workspace    (`/treatments/sessions/:id`)
 *
 * Every permission gate is preserved exactly as it was on the page it came from: a tab is only
 * offered when the viewer holds the permission its former route required, and the panel body is
 * additionally guarded on render so a stale `?tab=` cannot smuggle a panel past the check.
 */
export default function TreatmentsHubPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Same permission sets the individual routes were guarded on before consolidation.
  const canViewSessions = hasAnyPermission(user?.permissions, [
    PERMISSIONS.TREATMENT_SESSION_VIEW,
    PERMISSIONS.TREATMENT_SESSION_ALL,
  ]);
  const canViewPlans = hasAnyPermission(user?.permissions, [
    PERMISSIONS.TREATMENT_PLAN_VIEW,
    PERMISSIONS.TREATMENT_PLAN_ALL,
  ]);
  const canViewSafety = hasAnyPermission(user?.permissions, [
    PERMISSIONS.ADVERSE_EVENT_VIEW,
    PERMISSIONS.ADVERSE_EVENT_CREATE,
    PERMISSIONS.PATCH_TEST_VIEW,
  ]);

  const TABS = [
    ...(canViewSessions
      ? [{ id: 'sessions', label: t('treatments.hub.tabs.sessions', 'Sessions') }]
      : []),
    ...(canViewPlans
      ? [
          { id: 'plans', label: t('treatments.hub.tabs.plans', 'Plans') },
          { id: 'protocols', label: t('treatments.hub.tabs.protocols', 'Protocols') },
          { id: 'packages', label: t('treatments.hub.tabs.packages', 'Packages') },
        ]
      : []),
    ...(canViewSafety ? [{ id: 'safety', label: t('treatments.hub.tabs.safety', 'Safety') }] : []),
  ];

  // Deep-linked from the session execution page's "Record adverse event" button — pre-fills the
  // report form so the technician doesn't have to re-search for the patient.
  const patientIdFromQuery = searchParams.get('patientId') || undefined;

  const requested = searchParams.get('tab');
  const fallback = TABS[0]?.id || null;
  const [tab, setTab] = useState(
    TABS.some((x) => x.id === requested) ? requested : fallback
  );

  const selectTab = (id) => {
    setTab(id);
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('treatments.hub.title', 'Treatments')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'treatments.hub.subtitle',
              'Sessions, plans, protocols, packages and safety in one place.'
            )}
          </p>
        </div>
        {canViewSessions && (
          <Button asChild variant="outline">
            {/* Literal fallback keeps this render-safe until the route constant is wired in. */}
            <Link to={APP_ROUTES.TECHNICIAN_WORKLIST || '/treatments/worklist'}>
              <HardHat className="h-4 w-4" />
              {t('treatments.hub.technicianWorklist', 'Technician worklist')}
            </Link>
          </Button>
        )}
      </div>

      {TABS.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('treatments.hub.noAccess', 'You do not have access to any treatment area.')}
        </p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto border-b border-border pb-px">
            {TABS.map((tb) => (
              <button
                key={tb.id}
                type="button"
                onClick={() => selectTab(tb.id)}
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

          {tab === 'sessions' && canViewSessions && <SessionQueuePanel />}
          {tab === 'plans' && canViewPlans && <TreatmentPlanListPanel />}
          {tab === 'protocols' && canViewPlans && <ProtocolLibraryPanel />}
          {tab === 'packages' && canViewPlans && <PackageBuilderPanel />}
          {tab === 'safety' && canViewSafety && (
            <div className="space-y-8">
              <div className="space-y-3">
                <h2 className="font-display text-xl font-semibold">
                  {t('treatments.safety.patchTest.title', 'Patch tests')}
                </h2>
                <PatchTestPanel />
              </div>
              <div className="space-y-3">
                <h2 className="font-display text-xl font-semibold">
                  {t('treatments.safety.register.sectionTitle', 'Adverse events')}
                </h2>
                <AdverseEventRegisterPanel patientId={patientIdFromQuery} />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
