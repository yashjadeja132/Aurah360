import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ROLE_LABELS } from '@/constants/rbac';
import { staffDetailPath, staffEditPath } from '@/constants/routes';
import { EmptyState } from '@/components/common/EmptyState';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';
import { Skeleton } from '@/components/ui/skeleton';

export function StaffTable({ items = [], isLoading, onActivate, onDeactivate }) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        title={t('users.table.emptyTitle')}
        description={t('users.table.emptyDescription')}
      />
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('users.table.nameHeader')}</TableHead>
            <TableHead>{t('users.table.roleHeader')}</TableHead>
            <TableHead>{t('users.table.employeeIdHeader')}</TableHead>
            <TableHead>{t('users.table.statusHeader')}</TableHead>
            <TableHead className="text-right">{t('users.table.actionsHeader')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </TableCell>
              <TableCell>{ROLE_LABELS[user.role] || user.role}</TableCell>
              <TableCell>{user.employeeId || '—'}</TableCell>
              <TableCell>
                <Badge variant={user.isActive ? 'success' : 'warning'}>
                  {user.isActive ? t('users.table.active') : t('users.table.inactive')}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link to={staffDetailPath(user.id)}>{t('users.table.view')}</Link>
                  </Button>
                  <PermissionGuard permissions={[PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_ALL]}>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={staffEditPath(user.id)}>{t('users.table.edit')}</Link>
                    </Button>
                  </PermissionGuard>
                  <PermissionGuard permissions={[PERMISSIONS.USERS_ACTIVATE, PERMISSIONS.USERS_ALL]}>
                    {user.isActive ? (
                      <Button variant="ghost" size="sm" onClick={() => onDeactivate?.(user)}>
                        {t('users.table.deactivate')}
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => onActivate?.(user)}>
                        {t('users.table.activate')}
                      </Button>
                    )}
                  </PermissionGuard>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default StaffTable;
