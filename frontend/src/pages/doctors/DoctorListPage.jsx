import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/common/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { Skeleton } from '@/components/ui/skeleton';
import { DoctorCard } from '@/modules/doctors/components/DoctorCard';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

export default function DoctorListPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 12,
    search: '',
    isActive: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const params = useMemo(() => {
    const p = { ...filters };
    if (!p.search) delete p.search;
    if (!p.isActive) delete p.isActive;
    return p;
  }, [filters]);

  const { data, isLoading, isError, error } = useDoctorList(params);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('doctors.title', 'Doctors')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('doctors.list.subtitle', 'Clinical profiles, schedules and leave for Aurah 360.')}
          </p>
        </div>
        <PermissionGuard permissions={[PERMISSIONS.DOCTORS_CREATE, PERMISSIONS.DOCTORS_ALL]}>
          <Button asChild>
            <Link to={APP_ROUTES.DOCTOR_CREATE}>
              <Plus className="h-4 w-4" />
              {t('doctors.list.addDoctor', 'Add doctor')}
            </Link>
          </Button>
        </PermissionGuard>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          placeholder={t('doctors.list.searchPlaceholder', 'Search code, specialization…')}
          value={filters.search}
          onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value, page: 1 }))}
        />
        <Select
          value={filters.isActive}
          onChange={(e) => setFilters((p) => ({ ...p, isActive: e.target.value, page: 1 }))}
        >
          <option value="">{t('doctors.list.allStatuses', 'All statuses')}</option>
          <option value="true">{t('doctors.list.active', 'Active')}</option>
          <option value="false">{t('doctors.list.inactive', 'Inactive')}</option>
        </Select>
        <Select
          value={filters.sortBy}
          onChange={(e) => setFilters((p) => ({ ...p, sortBy: e.target.value }))}
        >
          <option value="createdAt">{t('doctors.list.sortNewest', 'Newest')}</option>
          <option value="doctorCode">{t('doctors.list.sortCode', 'Code')}</option>
          <option value="specialization">{t('doctors.list.sortSpecialization', 'Specialization')}</option>
          <option value="consultationFee">{t('doctors.list.sortFee', 'Fee')}</option>
        </Select>
      </div>

      {isError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error?.response?.data?.message || t('doctors.list.loadFailed', 'Failed to load doctors')}
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : !(data?.items || []).length ? (
        <EmptyState
          title={t('doctors.list.emptyTitle', 'No doctors')}
          description={t('doctors.list.emptyDescription', 'Link a DOCTOR user to create a clinical profile.')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.items.map((doctor) => (
            <DoctorCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      )}

      <Pagination meta={data?.meta} onPageChange={(page) => setFilters((p) => ({ ...p, page }))} />
    </section>
  );
}
