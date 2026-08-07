import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StaffForm } from '@/modules/users/components/StaffForm';
import { useCreateStaff } from '@/modules/users/hooks/useStaff';
import { staffDetailPath } from '@/constants/routes';

export default function StaffCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createStaff = useCreateStaff();

  const onSubmit = async (values) => {
    try {
      const payload = {
        ...values,
        phone: values.phone || null,
        gender: values.gender || null,
        department: values.department || null,
        designation: values.designation || null,
        employeeId: values.employeeId || null,
      };
      const res = await createStaff.mutateAsync(payload);
      toast.success(t('users.create.success'));
      navigate(staffDetailPath(res.data.user.id));
    } catch (err) {
      toast.error(err.response?.data?.message || t('users.create.failed'));
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('users.create.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('users.create.subtitle')}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('users.create.detailsTitle')}</CardTitle>
          <CardDescription>{t('users.create.detailsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <StaffForm mode="create" onSubmit={onSubmit} isSubmitting={createStaff.isPending} />
        </CardContent>
      </Card>
    </section>
  );
}
