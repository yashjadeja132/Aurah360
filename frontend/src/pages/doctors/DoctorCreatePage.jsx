import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DoctorForm } from '@/modules/doctors/components/DoctorForm';
import { useDoctorMutations } from '@/modules/doctors/hooks/useDoctors';
import { useMasterActive } from '@/modules/masters/hooks/useMasters';
import { usersApi } from '@/modules/users/api/usersApi';
import { branchesApi } from '@/modules/branches/api/branchesApi';
import { doctorDetailPath } from '@/constants/routes';

export default function DoctorCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { create } = useDoctorMutations();
  const { data: departments = [] } = useMasterActive('departments');
  const { data: services = [] } = useMasterActive('services');

  const { data: users = [] } = useQuery({
    queryKey: ['staff', 'doctors-candidates'],
    queryFn: async () => {
      const res = await usersApi.list({ role: 'DOCTOR', limit: 100, isActive: 'true' });
      return res.data || [];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', 'active-all'],
    queryFn: async () => {
      const res = await branchesApi.list({ isActive: 'true', limit: 100 });
      return res.data || [];
    },
  });

  const onSubmit = async (values) => {
    try {
      const res = await create.mutateAsync(values);
      toast.success(t('doctors.create.toastCreated', 'Doctor created'));
      navigate(doctorDetailPath(res.data.doctor.id));
    } catch (err) {
      toast.error(err.response?.data?.message || t('doctors.create.createFailed', 'Create failed'));
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('doctors.create.title', 'Add doctor')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('doctors.create.subtitle', 'Link an existing DOCTOR user — identity stays on the User record.')}
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>{t('doctors.form.clinicalProfile', 'Clinical profile')}</CardTitle></CardHeader>
        <CardContent>
          <DoctorForm
            mode="create"
            users={users}
            branches={branches}
            departments={departments}
            services={services}
            onSubmit={onSubmit}
            isSubmitting={create.isPending}
          />
        </CardContent>
      </Card>
    </section>
  );
}
