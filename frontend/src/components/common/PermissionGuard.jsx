import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissions';

/**
 * Renders children only when the user has ANY of the required permissions.
 * Owner (permissions includes *) always passes.
 */
export function PermissionGuard({ permissions = [], fallback = null, children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-[8rem] items-center justify-center text-sm text-muted-foreground">
        Checking permissions…
      </div>
    );
  }

  if (!hasAnyPermission(user?.permissions, permissions)) {
    if (fallback === 'redirect') {
      return <Navigate to="/" replace />;
    }
    return fallback;
  }

  return children;
}

export default PermissionGuard;
