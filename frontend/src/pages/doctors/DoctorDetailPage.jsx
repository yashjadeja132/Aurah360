import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { useDoctorDetail, useDoctorMutations } from '@/modules/doctors/hooks/useDoctors';
import {
  APP_ROUTES,
  doctorEditPath,
  doctorLeavePath,
  doctorSchedulePath,
} from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

export default function DoctorDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: doctor, isLoading, isError } = useDoctorDetail(id);
  const { activate, deactivate, remove } = useDoctorMutations();

  if (isLoading) return <Skeleton className="h-80 w-full" />;
  if (isError || !doctor) return <p className="text-destructive">{t('doctors.detail.notFound', 'Doctor not found.')}</p>;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to={APP_ROUTES.DOCTORS}>← {t('doctors.title', 'Doctors')}</Link>
          </Button>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {doctor.user?.fullName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {doctor.doctorCode} · {doctor.specialization || '—'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionGuard permissions={[PERMISSIONS.DOCTORS_EDIT, PERMISSIONS.DOCTORS_ALL]}>
            <Button asChild variant="outline"><Link to={doctorEditPath(id)}>{t('common.edit', 'Edit')}</Link></Button>
            {doctor.isActive ? (
              <Button variant="outline" onClick={() => deactivate.mutateAsync(id).then(() => toast.success(t('doctors.detail.toastDeactivated', 'Deactivated')))}>
                {t('doctors.detail.deactivate', 'Deactivate')}
              </Button>
            ) : (
              <Button variant="outline" onClick={() => activate.mutateAsync(id).then(() => toast.success(t('doctors.detail.toastActivated', 'Activated')))}>
                {t('doctors.detail.activate', 'Activate')}
              </Button>
            )}
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.DOCTOR_SCHEDULE_VIEW, PERMISSIONS.DOCTOR_SCHEDULE_ALL]}>
            <Button asChild variant="outline"><Link to={doctorSchedulePath(id)}>{t('doctors.detail.schedule', 'Schedule')}</Link></Button>
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.DOCTOR_LEAVE_VIEW, PERMISSIONS.DOCTOR_LEAVE_ALL]}>
            <Button asChild variant="outline"><Link to={doctorLeavePath(id)}>{t('doctors.detail.leave', 'Leave')}</Link></Button>
          </PermissionGuard>
          <PermissionGuard permissions={[PERMISSIONS.DOCTORS_DELETE, PERMISSIONS.DOCTORS_ALL]}>
            <Button
              variant="destructive"
              onClick={() => {
                if (!window.confirm(t('doctors.detail.deleteConfirm', 'Soft-delete this doctor profile?'))) return;
                remove.mutateAsync(id).then(() => {
                  toast.success(t('doctors.detail.toastDeleted', 'Deleted'));
                  navigate(APP_ROUTES.DOCTORS);
                });
              }}
            >
              {t('common.delete', 'Delete')}
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('doctors.detail.profile', 'Profile')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={t('doctors.detail.status', 'Status')} value={<Badge variant={doctor.isActive ? 'success' : 'warning'}>{doctor.status}</Badge>} />
            <Row label={t('doctors.detail.qualification', 'Qualification')} value={doctor.qualification || '—'} />
            <Row label={t('doctors.detail.experience', 'Experience')} value={t('doctors.detail.yearsSuffix', '{{count}} yrs', { count: doctor.experienceYears || 0 })} />
            <Row label={t('doctors.detail.consultFee', 'Consult fee')} value={`₹${doctor.consultationFee || 0}`} />
            <Row label={t('doctors.detail.duration', 'Duration')} value={t('doctors.detail.minutesSuffix', '{{count}} min', { count: doctor.consultationDuration })} />
            <Row label={t('doctors.detail.license', 'License')} value={doctor.licenseNumber} />
            <Row label={t('doctors.detail.registration', 'Registration')} value={doctor.registrationNumber} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t('doctors.detail.assignments', 'Assignments')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label={t('doctors.detail.branches', 'Branches')} value={(doctor.branchNames || []).join(', ') || '—'} />
            <Row label={t('doctors.detail.departments', 'Departments')} value={(doctor.departmentNames || []).join(', ') || '—'} />
            <Row label={t('doctors.detail.services', 'Services')} value={(doctor.serviceNames || []).join(', ') || '—'} />
            <Row
              label={t('doctors.detail.today', 'Today')}
              value={
                doctor.todayAvailability?.available
                  ? t('doctors.detail.slotsCount', '{{count}} slots', { count: doctor.todayAvailability.slots.length })
                  : doctor.todayAvailability?.reason || t('doctors.detail.unavailable', 'Unavailable')
              }
            />
          </CardContent>
        </Card>
      </div>
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
