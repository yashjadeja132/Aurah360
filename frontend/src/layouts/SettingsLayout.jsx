import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { MASTER_NAV } from '@/modules/masters/config/masterConfigs';
import { APP_ROUTES } from '@/constants/routes';
import { cn } from '@/utils/cn';
import { hasAnyPermission } from '@/utils/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/constants/rbac';

export function SettingsLayout() {
  const { user } = useAuth();
  const canBranches = hasAnyPermission(user?.permissions, [
    PERMISSIONS.BRANCHES_VIEW,
    PERMISSIONS.BRANCHES_ALL,
  ]);
  const canMasters = hasAnyPermission(user?.permissions, [
    PERMISSIONS.MASTERS_VIEW,
    PERMISSIONS.MASTERS_ALL,
  ]);
  const canTreatmentPlans = hasAnyPermission(user?.permissions, [
    PERMISSIONS.TREATMENT_PLAN_VIEW,
    PERMISSIONS.TREATMENT_PLAN_ALL,
  ]);
  const canInventory = hasAnyPermission(user?.permissions, [
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_ALL,
  ]);
  const canConsultationTemplates = hasAnyPermission(user?.permissions, [
    PERMISSIONS.CONSULTATION_TEMPLATE_MANAGE,
  ]);

  const links = [
    ...(canBranches ? [{ to: APP_ROUTES.BRANCHES, label: 'Branches' }] : []),
    ...(canMasters
      ? MASTER_NAV.map((m) => ({ to: `/settings/${m.slug}`, label: m.title }))
      : []),
    // Treatment protocols and product/vendor (supplier) masters live in their own
    // org-wide modules (see BranchDetailPage docblock for why they aren't part of
    // the generic /settings/:masterSlug catalogue), but the Masters section spec
    // requires them to be reachable from here, so link out to their real pages.
    ...(canTreatmentPlans
      ? [{ to: APP_ROUTES.TREATMENT_PROTOCOLS, label: 'Treatment Protocols' }]
      : []),
    ...(canInventory ? [{ to: APP_ROUTES.SUPPLIERS, label: 'Vendors / Suppliers' }] : []),
    // Consultation templates are a master-data category per spec ("versioned, medical-lead
    // approved") but live on the consultation model, not the generic Master collection — same
    // reasoning as Treatment Protocols/Suppliers above, so link out rather than route through
    // the generic /settings/:masterSlug catalogue.
    ...(canConsultationTemplates
      ? [{ to: APP_ROUTES.SETTINGS_CONSULTATION_TEMPLATES, label: 'Consultation Templates' }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Branches and master data for Aurah 360 ClinicOS.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                'rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-accent'
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>

      <Suspense
        fallback={
          <div className="flex min-h-[8rem] items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </div>
  );
}

export default SettingsLayout;
