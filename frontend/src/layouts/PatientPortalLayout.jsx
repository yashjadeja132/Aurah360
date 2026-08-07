import { Suspense } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  FileHeart,
  Pill,
  Activity,
  IndianRupee,
  Bell,
  UserCircle,
  MessageSquare,
  LogOut,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/constants/config';
import { PORTAL_ROUTES } from '@/constants/routes';
import { usePatientAuth } from '@/contexts/PatientAuthContext';
import { usePatientLogout, usePatientUnread } from '@/modules/patientPortal/hooks/usePatientPortal';
import { cn } from '@/utils/cn';
import { toast } from 'sonner';

const nav = [
  { to: PORTAL_ROUTES.DASHBOARD, label: 'Home', icon: LayoutDashboard },
  { to: PORTAL_ROUTES.APPOINTMENTS, label: 'Appointments', icon: Calendar },
  { to: PORTAL_ROUTES.RECORDS, label: 'Records', icon: FileHeart },
  { to: PORTAL_ROUTES.PRESCRIPTIONS, label: 'Prescriptions', icon: Pill },
  { to: PORTAL_ROUTES.TREATMENTS, label: 'Treatments', icon: Activity },
  { to: PORTAL_ROUTES.BILLING, label: 'Billing', icon: IndianRupee },
  { to: PORTAL_ROUTES.DOCUMENTS, label: 'Documents', icon: FolderOpen },
  { to: PORTAL_ROUTES.NOTIFICATIONS, label: 'Alerts', icon: Bell },
  { to: PORTAL_ROUTES.FEEDBACK, label: 'Feedback', icon: MessageSquare },
  { to: PORTAL_ROUTES.PROFILE, label: 'Profile', icon: UserCircle },
];

export default function PatientPortalLayout() {
  const { patient } = usePatientAuth();
  const logout = usePatientLogout();
  const { data: unread } = usePatientUnread();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#ecfdf5_0%,_#f8fafc_45%,_#ffffff_100%)]">
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-display text-lg font-semibold text-teal-900">{APP_CONFIG.name}</p>
            <p className="text-xs text-muted-foreground">Patient Portal</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {patient?.fullName || patient?.firstName}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await logout.mutateAsync();
                  toast.success('Signed out');
                  navigate(PORTAL_ROUTES.LOGIN);
                } catch {
                  navigate(PORTAL_ROUTES.LOGIN);
                }
              }}
            >
              <LogOut className="mr-1 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === PORTAL_ROUTES.DASHBOARD}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition',
                  isActive ? 'bg-teal-800 text-white' : 'text-teal-950/80 hover:bg-teal-50'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.to === PORTAL_ROUTES.NOTIFICATIONS && unread?.count > 0 ? (
                <span className="rounded-full bg-rose-600 px-1.5 text-[10px] text-white">
                  {unread.count}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
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
  );
}
