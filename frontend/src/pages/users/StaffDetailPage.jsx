import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useStaffDetail, useStaffActions } from '@/modules/users/hooks/useStaff';
import { ROLE_LABELS, PERMISSIONS } from '@/constants/rbac';
import { APP_ROUTES, staffEditPath } from '@/constants/routes';

export default function StaffDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: user, isLoading, isError, refetch } = useStaffDetail(id);
  const actions = useStaffActions();
  const [resetOpen, setResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const handleReset = async () => {
    try {
      await actions.resetPassword.mutateAsync({ id, newPassword });
      toast.success(t('users.detail.resetSuccess'));
      setResetOpen(false);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || t('users.detail.resetFailed'));
    }
  };

  const handleSoftDelete = async () => {
    if (!window.confirm(t('users.detail.confirmDelete'))) return;
    try {
      await actions.remove.mutateAsync(id);
      toast.success(t('users.detail.deleteSuccess'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('users.detail.deleteFailed'));
    }
  };

  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (isError || !user) return <p className="text-destructive">{t('users.detail.notFound')}</p>;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to={APP_ROUTES.STAFF}>{t('users.detail.backToStaff')}</Link>
          </Button>
          <h1 className="font-display text-3xl font-semibold text-primary">{user.fullName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionGuard permissions={[PERMISSIONS.USERS_EDIT, PERMISSIONS.USERS_ALL]}>
            <Button asChild variant="outline">
              <Link to={staffEditPath(user.id)}>{t('users.detail.edit')}</Link>
            </Button>
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.USERS_RESET_PASSWORD, PERMISSIONS.USERS_ALL]}>
            <Button variant="outline" onClick={() => setResetOpen(true)}>{t('users.detail.resetPassword')}</Button>
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.USERS_DELETE, PERMISSIONS.USERS_ALL]}>
            {user.role !== 'OWNER' && (
              <Button variant="destructive" onClick={handleSoftDelete}>{t('users.detail.delete')}</Button>
            )}
          </PermissionGuard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('users.detail.profileTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label={t('users.detail.roleLabel')} value={ROLE_LABELS[user.role] || user.role} />
            <Row label={t('users.detail.statusLabel')} value={<Badge variant={user.isActive ? 'success' : 'warning'}>{user.status}</Badge>} />
            <Row label={t('users.detail.phoneLabel')} value={user.phone || '—'} />
            <Row label={t('users.detail.employeeIdLabel')} value={user.employeeId || '—'} />
            <Row label={t('users.detail.departmentLabel')} value={user.department || '—'} />
            <Row label={t('users.detail.designationLabel')} value={user.designation || '—'} />
            <Row label={t('users.detail.genderLabel')} value={user.gender || '—'} />
            <Row label={t('users.detail.lastLoginLabel')} value={user.lastLogin ? new Date(user.lastLogin).toLocaleString() : '—'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('users.detail.permissionsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(user.permissions || []).length ? (
                user.permissions.map((p) => (
                  <Badge key={p} variant="secondary">{p}</Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t('users.detail.noPermissions')}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" className="mt-4" onClick={() => refetch()}>
              {t('users.detail.refresh')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('users.detail.resetPasswordTitle')}</DialogTitle>
            <DialogDescription>
              {t('users.detail.resetPasswordDescription', { name: user.firstName })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('users.detail.newPasswordLabel')}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>{t('users.detail.cancel')}</Button>
            <Button onClick={handleReset} disabled={newPassword.length < 8 || actions.resetPassword.isPending}>
              {t('users.detail.reset')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
