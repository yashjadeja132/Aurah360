import { Suspense, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  LogOut,
  KeyRound,
  Settings,
  Stethoscope,
  HeartPulse,
  CalendarCheck2,
  ClipboardList,
  ListOrdered,
  FileHeart,
  Pill,
  IndianRupee,
  Package,
  Syringe,
  BarChart3,
  ChevronDown,
  Menu,
  X,
  FlaskConical,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/constants/config';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS, ROLES, ROLE_LABELS } from '@/constants/rbac';
import { hasAnyPermission } from '@/utils/permissions';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';
import { NotificationBell } from '@/components/common/NotificationBell';

/**
 * Role shorthands used by the nav model below.
 *
 * `roles` on a group or item is a WHITELIST: the entry is FOR those roles. It is an
 * additional gate on top of `permissions`, never a replacement — an entry renders only
 * when the role check AND the permission check both pass (defence in depth; the API is
 * the real authority). Omitting `roles` means "every role", subject to permissions.
 */
const ADMINS = [ROLES.OWNER, ROLES.ADMIN];

/**
 * Simplified 4-role navigation (vaibhav-development rework, docs/SIMPLIFIED_FLOW.md).
 * Doctor / Receptionist / Pharmacy / Owner — each role sees only its own flow.
 * The old modules (CRM, loyalty, treatments, analytics…) keep their routes for deep
 * links but come out of the menu entirely.
 */
const navGroups = [
  {
    labelKey: 'nav.overview',
    label: 'Overview',
    // `/` resolves through RoleLanding: doctor → My day, receptionist → Front desk,
    // pharmacy → Pharmacy, owner → owner dashboard.
    items: [{ to: APP_ROUTES.DASHBOARD, labelKey: 'nav.dashboard', label: 'Home', icon: LayoutDashboard }],
  },
  {
    labelKey: 'nav.frontDesk',
    label: 'Front desk',
    items: [
      { to: APP_ROUTES.RECEPTION_DESK, labelKey: 'nav.receptionDesk', label: 'Front desk', icon: ClipboardList, roles: [...ADMINS, ROLES.RECEPTIONIST], permissions: [PERMISSIONS.RECEPTION_VIEW, PERMISSIONS.RECEPTION_ALL] },
      { to: APP_ROUTES.PATIENTS, labelKey: 'nav.patients', label: 'Patients', icon: HeartPulse, roles: [...ADMINS, ROLES.RECEPTIONIST, ROLES.DOCTOR], permissions: [PERMISSIONS.PATIENTS_VIEW, PERMISSIONS.PATIENTS_ALL] },
      { to: APP_ROUTES.APPOINTMENTS, labelKey: 'nav.appointments', label: 'Appointments', icon: CalendarCheck2, roles: [...ADMINS, ROLES.RECEPTIONIST], permissions: [PERMISSIONS.APPOINTMENTS_VIEW, PERMISSIONS.APPOINTMENTS_ALL] },
      { to: APP_ROUTES.BILLING, labelKey: 'nav.billing', label: 'Billing', icon: IndianRupee, roles: [...ADMINS, ROLES.RECEPTIONIST], permissions: [PERMISSIONS.BILLING_VIEW, PERMISSIONS.BILLING_ALL] },
    ],
  },
  {
    labelKey: 'nav.clinical',
    label: 'Doctor',
    items: [
      // The receptionist reaches the queue board from the Front desk screen, so this
      // entry stays doctor-only to keep their menu single-purpose.
      { to: APP_ROUTES.QUEUE, labelKey: 'nav.queue', label: 'My queue', icon: ListOrdered, roles: [...ADMINS, ROLES.DOCTOR], permissions: [PERMISSIONS.QUEUE_VIEW, PERMISSIONS.QUEUE_ALL] },
      { to: APP_ROUTES.CONSULTATIONS, labelKey: 'nav.emr', label: 'Patient files', icon: FileHeart, roles: [...ADMINS, ROLES.DOCTOR], permissions: [PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL] },
      { to: APP_ROUTES.REPORT_REVIEW_QUEUE, labelKey: 'nav.reportReview', label: 'Reports', icon: FlaskConical, roles: [...ADMINS, ROLES.DOCTOR], permissions: [PERMISSIONS.CONSULTATION_VIEW, PERMISSIONS.CONSULTATION_ALL] },
      { to: APP_ROUTES.PRESCRIPTIONS, labelKey: 'nav.prescriptions', label: 'Prescriptions', icon: Pill, roles: [...ADMINS, ROLES.DOCTOR], permissions: [PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.PRESCRIPTION_ALL] },
    ],
  },
  {
    labelKey: 'nav.operations',
    label: 'Pharmacy',
    items: [
      { to: APP_ROUTES.PHARMACY, labelKey: 'nav.pharmacy', label: 'Pharmacy', icon: Syringe, roles: [...ADMINS, ROLES.PHARMACIST], permissions: [PERMISSIONS.PHARMACY_VIEW, PERMISSIONS.PHARMACY_ALL] },
      { to: APP_ROUTES.INVENTORY, labelKey: 'nav.inventory', label: 'Stock', icon: Package, roles: [...ADMINS, ROLES.PHARMACIST], permissions: [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_ALL] },
    ],
  },
  {
    labelKey: 'nav.administration',
    label: 'Administration',
    items: [
      { to: APP_ROUTES.STAFF, labelKey: 'nav.staff', label: 'Staff', icon: Users, roles: ADMINS, permissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_ALL] },
      { to: APP_ROUTES.DOCTORS, labelKey: 'nav.doctors', label: 'Doctors', icon: Stethoscope, roles: ADMINS, permissions: [PERMISSIONS.DOCTORS_VIEW, PERMISSIONS.DOCTORS_ALL] },
      { to: APP_ROUTES.REPORTS, labelKey: 'nav.reports', label: 'Reports', icon: BarChart3, roles: ADMINS, permissions: [PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_ALL, PERMISSIONS.DASHBOARD_VIEW] },
      {
        to: APP_ROUTES.SETTINGS,
        labelKey: 'nav.settings',
        label: 'Settings',
        icon: Settings,
        roles: ADMINS,
        permissions: [PERMISSIONS.BRANCHES_VIEW, PERMISSIONS.BRANCHES_ALL, PERMISSIONS.MASTERS_VIEW, PERMISSIONS.MASTERS_ALL],
      },
    ],
  },
];

function initialsOf(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'U';
}

function SidebarContent({ user, visibleGroups, onNavigate }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-0 flex-col px-3 py-5">
      <div className="mb-5 shrink-0 px-3">
        <p className="font-display text-xl font-semibold text-primary">{APP_CONFIG.name}</p>
        <p className="text-xs text-muted-foreground">Aurah 360 · Surat</p>
      </div>

      <nav className="sidebar-nav min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden pb-2">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="section-label mb-1.5">{t(group.labelKey, group.label)}</p>
            <div className="space-y-0.5">
              {group.items.map(({ to, label, labelKey, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === APP_ROUTES.DASHBOARD}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-elev-sm'
                        : 'text-foreground/75 hover:bg-accent hover:text-accent-foreground'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute -left-3 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-primary" />
                      )}
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t(labelKey, label)}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-3 shrink-0 border-t border-border/60 pt-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {initialsOf(user?.fullName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">{user?.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{ROLE_LABELS?.[user?.role] || user?.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const { t } = useTranslation();
  const { user, logout, isLoggingOut } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Signed out');
    } catch {
      toast.error('Signed out locally');
    }
    navigate(APP_ROUTES.LOGIN, { replace: true });
  };

  /**
   * Both gates must pass. The permission gate alone was too coarse: a role granted one narrow
   * permission inherited whole sections — DOCTOR holds reports.view for its own dashboard, which
   * was enough to surface the Branch Manager command screen. `roles` is a whitelist; omitting it
   * means "every role", still subject to permissions.
   */
  const allowedForRole = (entry) => !entry.roles || entry.roles.includes(user?.role);

  const visibleGroups = navGroups
    .filter(allowedForRole)
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          allowedForRole(item) &&
          (!item.permissions || hasAnyPermission(user?.permissions, item.permissions))
      ),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen lg:grid lg:h-screen lg:grid-cols-[260px_1fr] lg:overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-border/70 bg-card/90 lg:block lg:h-screen">
        <SidebarContent user={user} visibleGroups={visibleGroups} />
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-card shadow-elev-lg">
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <SidebarContent user={user} visibleGroups={visibleGroups} onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-h-0 flex-col lg:h-screen lg:overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/70 bg-card/80 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNavOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="lg:hidden">
              <p className="font-display text-base font-semibold text-primary">{APP_CONFIG.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher className="hidden sm:flex" />
            <NotificationBell />
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-border/70 bg-background px-2 py-1.5 pr-3 text-sm hover:bg-accent"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initialsOf(user?.fullName)}
                </span>
                <span className="hidden max-w-[10rem] truncate font-medium sm:inline">{user?.fullName}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border/70 bg-card p-1.5 shadow-elev-lg">
                    <div className="px-2.5 py-2">
                      <p className="truncate text-sm font-medium">{user?.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{ROLE_LABELS?.[user?.role] || user?.role}</p>
                    </div>
                    <div className="my-1 h-px bg-border/70" />
                    <NavLink
                      to={APP_ROUTES.PROFILE}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent"
                    >
                      <UserCircle className="h-4 w-4" /> {t('nav.profile', 'Profile')}
                    </NavLink>
                    <NavLink
                      to={APP_ROUTES.CHANGE_PASSWORD}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent"
                    >
                      <KeyRound className="h-4 w-4" /> {t('nav.changePassword', 'Change password')}
                    </NavLink>
                    <div className="my-1 h-px bg-border/70" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4" /> {t('nav.signOut', 'Sign out')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <Suspense
            fallback={
              <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
