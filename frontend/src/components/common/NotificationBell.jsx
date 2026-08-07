import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useUnreadCount } from '@/modules/notifications/hooks/useNotifications';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';
import { hasAnyPermission } from '@/utils/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/utils/cn';

export function NotificationBell({ className }) {
  const { user } = useAuth();
  const allowed = hasAnyPermission(user?.permissions || [], [
    PERMISSIONS.NOTIFICATIONS_VIEW,
    PERMISSIONS.NOTIFICATIONS_ALL,
  ]);
  const { data: count = 0 } = useUnreadCount({ enabled: allowed });

  if (!allowed) return null;

  return (
    <Link
      to={APP_ROUTES.NOTIFICATIONS}
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-muted',
        className
      )}
      title="Notifications"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

export default NotificationBell;
