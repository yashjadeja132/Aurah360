import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DoctorForm } from '@/modules/doctors/components/DoctorForm';
import { useDoctorDetail, useDoctorMutations } from '@/modules/doctors/hooks/useDoctors';
import { useMasterActive } from '@/modules/masters/hooks/useMasters';
import { branchesApi } from '@/modules/branches/api/branchesApi';
import { doctorDetailPath } from '@/constants/routes';

export default function DoctorEditPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: doctor, isLoading, isError } = useDoctorDetail(id);
  const { update } = useDoctorMutations();
  const { data: departments = [] } = useMasterActive('departments');
  const { data: services = [] } = useMasterActive('services');

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', 'active-all'],
    queryFn: async () => {
      const res = await branchesApi.list({ isActive: 'true', limit: 100 });
      return res.data || [];
    },
  });

  const onSubmit = async (values) => {
    try {
      const { userId, ...payload } = values;
      await update.mutateAsync({ id, payload });
      toast.success(t('doctors.edit.toastUpdated', 'Doctor updated'));
      navigate(doctorDetailPath(id));
    } catch (err) {
      toast.error(err.response?.data?.message || t('doctors.edit.updateFailed', 'Update failed'));
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !doctor) return <p className="text-destructive">{t('doctors.detail.notFound', 'Doctor not found.')}</p>;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('doctors.edit.title', 'Edit doctor')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{doctor.user?.fullName}</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{t('doctors.form.clinicalProfile', 'Clinical profile')}</CardTitle></CardHeader>
        <CardContent>
          <DoctorForm
            mode="edit"
            branches={branches}
            departments={departments}
            services={services}
            defaultValues={{
              ...doctor,
              languages: (doctor.languages || []).join(','),
              gender: doctor.gender || '',
            }}
            onSubmit={onSubmit}
            isSubmitting={update.isPending}
          />
        </CardContent>
      </Card>
    </section>
  );
}
