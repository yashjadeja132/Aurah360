import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { doctorDetailPath, doctorEditPath } from '@/constants/routes';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PERMISSIONS } from '@/constants/rbac';

export function DoctorCard({ doctor }) {
  const { t } = useTranslation();
  const name = doctor.user?.fullName || t('doctors.card.defaultName', 'Doctor');
  const available = doctor.todayAvailability?.available;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex gap-4">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
          style={{ background: doctor.colorCode || '#2563eb' }}
        >
          {doctor.profilePhoto ? (
            <img src={doctor.profilePhoto} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            name.slice(0, 1)
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold truncate">{name}</p>
              <p className="text-sm text-muted-foreground">{doctor.qualification || '—'}</p>
            </div>
            <Badge variant={doctor.isActive ? 'success' : 'warning'}>
              {doctor.isActive ? t('doctors.card.active', 'Active') : t('doctors.card.inactive', 'Inactive')}
            </Badge>
          </div>
          <p className="mt-2 text-sm">{doctor.specialization || '—'}</p>
          <p className="text-xs text-muted-foreground">
            {(doctor.departmentNames || []).join(', ') || t('doctors.card.noDepartment', 'No department')}
            {' · '}
            {(doctor.branchNames || []).join(', ') || t('doctors.card.noBranch', 'No branch')}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant={available ? 'success' : 'secondary'}>
              {t('doctors.card.today', 'Today:')} {available ? t('doctors.card.slotsCount', '{{count}} slots', { count: doctor.todayAvailability.slots?.length || 0 }) : (doctor.todayAvailability?.reason || t('doctors.card.unavailable', 'Unavailable'))}
            </Badge>
            <Button asChild size="sm" variant="outline">
              <Link to={doctorDetailPath(doctor.id)}>{t('doctors.card.view', 'View')}</Link>
            </Button>
            <PermissionGuard permissions={[PERMISSIONS.DOCTORS_EDIT, PERMISSIONS.DOCTORS_ALL]}>
              <Button asChild size="sm" variant="ghost">
                <Link to={doctorEditPath(doctor.id)}>{t('common.edit', 'Edit')}</Link>
              </Button>
            </PermissionGuard>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DoctorCard;
