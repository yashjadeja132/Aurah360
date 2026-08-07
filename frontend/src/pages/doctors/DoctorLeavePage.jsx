import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeaveManager } from '@/modules/doctors/components/LeaveManager';
import { useDoctorDetail } from '@/modules/doctors/hooks/useDoctors';
import { doctorDetailPath } from '@/constants/routes';

export default function DoctorLeavePage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: doctor, isLoading, isError } = useDoctorDetail(id);

  if (isLoading) return <Skeleton className="h-80 w-full" />;
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
          {t('doctors.leave.title', 'Leave management')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('doctors.leave.subtitle', 'Approved leave blocks availability for appointments.')}
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>{t('doctors.leave.records', 'Leave records')}</CardTitle></CardHeader>
        <CardContent>
          <LeaveManager doctorId={id} branches={branches} />
        </CardContent>
      </Card>
    </section>
  );
}
