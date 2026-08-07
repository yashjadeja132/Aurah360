import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/modules/auth/api/authApi';
import { changePasswordSchema } from '@/modules/users/validation/staffSchema';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { APP_ROUTES } from '@/constants/routes';

export default function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }) =>
      authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      toast.success(t('profile.changePassword.successToast', 'Password changed'));
      reset();
      navigate(APP_ROUTES.PROFILE);
    },
    onError: (err) =>
      toast.error(
        err.response?.data?.message || t('profile.changePassword.errorToast', 'Could not change password')
      ),
  });

  return (
    <section className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('profile.changePassword.title', 'Change password')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('profile.changePassword.subtitle', 'Use a strong password you do not reuse elsewhere.')}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.changePassword.cardTitle', 'Update password')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
            <div className="space-y-2">
              <Label htmlFor="currentPassword">
                {t('profile.changePassword.currentPasswordLabel', 'Current password')}
              </Label>
              <Input id="currentPassword" type="password" {...register('currentPassword')} />
              {errors.currentPassword && <p className="text-sm text-destructive">{errors.currentPassword.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('profile.changePassword.newPasswordLabel', 'New password')}</Label>
              <Input id="newPassword" type="password" {...register('newPassword')} />
              {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {t('profile.changePassword.confirmPasswordLabel', 'Confirm password')}
              </Label>
              <Input id="confirmPassword" type="password" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? t('profile.changePassword.updatingButton', 'Updating…')
                : t('profile.changePassword.updateButton', 'Update password')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
