import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StaffForm } from '@/modules/users/components/StaffForm';
import { useStaffDetail, useUpdateStaff } from '@/modules/users/hooks/useStaff';
import { staffDetailPath } from '@/constants/routes';

export default function StaffEditPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: user, isLoading, isError } = useStaffDetail(id);
  const updateStaff = useUpdateStaff(id);

  const onSubmit = async (values) => {
    try {
      const { password, ...rest } = values;
      const payload = {
        ...rest,
        phone: rest.phone || null,
        gender: rest.gender || null,
        department: rest.department || null,
        designation: rest.designation || null,
        employeeId: rest.employeeId || null,
      };
      await updateStaff.mutateAsync(payload);
      toast.success(t('users.edit.success'));
      navigate(staffDetailPath(id));
    } catch (err) {
      toast.error(err.response?.data?.message || t('users.edit.failed'));
    }
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (isError || !user) {
    return <p className="text-destructive">{t('users.edit.notFound')}</p>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('users.edit.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.fullName}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('users.edit.detailsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffForm
            mode="edit"
            defaultValues={{
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone || '',
              role: user.role === 'OWNER' ? 'ADMIN' : user.role,
              department: user.department || '',
              designation: user.designation || '',
              employeeId: user.employeeId || '',
              gender: user.gender || '',
            }}
            onSubmit={onSubmit}
            isSubmitting={updateStaff.isPending}
          />
        </CardContent>
      </Card>
    </section>
  );
}
