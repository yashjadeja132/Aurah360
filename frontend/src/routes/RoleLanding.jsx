import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { APP_ROUTES } from '@/constants/routes';
import { DashboardPage } from '@/routes/lazyPages';

/**
 * A1 — role-aware post-login landing.
 *
 * Every role keeps the generic `DashboardPage` at `/`. A DOCTOR is sent to the
 * clinical "My day" screen instead, which is what the login redirect, a page
 * refresh, and a bookmark on `/` all resolve through — so the role check lives in
 * exactly one place and no other role's landing changes.
 */
export const ROLE_LANDING_ROUTES = Object.freeze({
  DOCTOR: APP_ROUTES.DOCTOR_MY_DAY,
  NURSE: APP_ROUTES.NURSE_TODAY,
  TECHNICIAN: APP_ROUTES.TECHNICIAN_WORKLIST,
  CASHIER: APP_ROUTES.BILLING_CASHIER,
  OWNER: APP_ROUTES.OWNER_LANDING,
  RECEPTIONIST: APP_ROUTES.RECEPTION_DESK,
  BRANCH_MANAGER: APP_ROUTES.BRANCH_COMMAND,
});

export function RoleLanding() {
  const { user } = useAuth();
  const target = ROLE_LANDING_ROUTES[user?.role];
  if (target) return <Navigate to={target} replace />;
  return <DashboardPage />;
}

export default RoleLanding;
