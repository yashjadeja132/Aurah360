import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScheduleEditor } from '@/modules/doctors/components/ScheduleEditor';
import { useDoctorDetail } from '@/modules/doctors/hooks/useDoctors';
import { doctorDetailPath } from '@/constants/routes';

export default function DoctorSchedulePage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: doctor, isLoading, isError } = useDoctorDetail(id);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !doctor) return <p className="text-destructive">{t('doctors.detail.notFound', 'Doctor not found.')}</p>;

  const branches = (doctor.branches || []).map((branchId, index) => ({
    id: branchId,
    displayName: doctor.branchNames?.[index] || branchId,
  }));

  return (
    <section className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to={doctorDetailPath(id)}>← {doctor.user?.fullName}</Link>
        </Button>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('doctors.schedule.title', 'Weekly schedule')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('doctors.schedule.subtitle', 'Per-branch working hours, lunch and slot settings.')}
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>{t('doctors.schedule.editor', 'Schedule editor')}</CardTitle></CardHeader>
        <CardContent>
          <ScheduleEditor doctorId={id} branches={branches} />
        </CardContent>
      </Card>
    </section>
  );
}
