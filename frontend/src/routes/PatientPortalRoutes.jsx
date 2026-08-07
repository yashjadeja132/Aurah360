import { Navigate, Outlet } from 'react-router-dom';
import { PatientAuthProvider, usePatientAuth } from '@/contexts/PatientAuthContext';
import PatientPortalLayout from '@/layouts/PatientPortalLayout';
import { PORTAL_ROUTES } from '@/constants/routes';
import { patientStorage, PATIENT_STORAGE_KEYS } from '@/modules/patientPortal/storage';

function PatientProtected() {
  const { isAuthenticated, isLoading } = usePatientAuth();
  const hasToken = Boolean(patientStorage.get(PATIENT_STORAGE_KEYS.ACCESS_TOKEN));

  if (!hasToken) return <Navigate to={PORTAL_ROUTES.LOGIN} replace />;
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading portal…
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to={PORTAL_ROUTES.LOGIN} replace />;

  return <PatientPortalLayout />;
}

/** Wrapper so PatientAuthProvider only wraps portal tree */
export function PatientPortalShell() {
  return (
    <PatientAuthProvider>
      <Outlet />
    </PatientAuthProvider>
  );
}

export function PatientProtectedRoute() {
  return <PatientProtected />;
}
