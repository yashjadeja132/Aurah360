import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { APP_ROUTES } from '@/constants/routes';

export function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={APP_ROUTES.DASHBOARD} replace />;
  }

  return <Outlet />;
}

export default PublicRoute;
