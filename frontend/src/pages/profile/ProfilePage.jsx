import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/modules/auth/api/authApi';
import { profileSchema } from '@/modules/users/validation/staffSchema';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { GENDER_OPTIONS, ROLE_LABELS } from '@/constants/rbac';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { Link } from 'react-router-dom';
import { APP_ROUTES } from '@/constants/routes';
import { MfaSettingsCard } from '@/modules/auth/components/MfaSettingsCard';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: user?.phone || '',
      gender: user?.gender || '',
    },
  });

  const mutation = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (res) => {
      queryClient.setQueryData(QUERY_KEYS.AUTH_ME, res.data.user);
      toast.success(t('profile.profilePage.successToast', 'Profile updated'));
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || t('profile.profilePage.errorToast', 'Update failed')),
  });

  if (!user) return null;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('profile.profilePage.title', 'My profile')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ROLE_LABELS[user.role] || user.role} · {user.email}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={APP_ROUTES.CHANGE_PASSWORD}>{t('profile.profilePage.changePasswordLink', 'Change password')}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('profile.profilePage.cardTitle', 'Personal details')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) =>
              mutation.mutate({
                ...values,
                phone: values.phone || null,
                gender: values.gender || null,
              })
            )}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('profile.profilePage.firstNameLabel', 'First name')}</Label>
                <Input id="firstName" {...register('firstName')} />
                {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('profile.profilePage.lastNameLabel', 'Last name')}</Label>
                <Input id="lastName" {...register('lastName')} />
                {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">{t('profile.profilePage.phoneLabel', 'Phone')}</Label>
                <Input id="phone" {...register('phone')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">{t('profile.profilePage.genderLabel', 'Gender')}</Label>
                <Select id="gender" {...register('gender')}>
                  <option value="">{t('profile.profilePage.genderSelectOption', 'Select')}</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? t('profile.profilePage.savingButton', 'Saving…')
                : t('profile.profilePage.saveButton', 'Save profile')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <MfaSettingsCard />
    </section>
  );
}
