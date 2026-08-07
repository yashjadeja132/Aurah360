import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/common/Pagination';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { AppointmentTable } from '@/modules/appointments/components/AppointmentTable';
import { useAppointmentList } from '@/modules/appointments/hooks/useAppointments';
import { STATUS_OPTIONS, APPOINTMENT_STATUS_LABELS } from '@/modules/appointments/constants';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS } from '@/constants/rbac';

export default function AppointmentListPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    status: '',
    doctorId: '',
    branchId: '',
    from: '',
    to: '',
    sortBy: 'appointmentDate',
    sortOrder: 'desc',
  });

  const params = useMemo(() => {
    const p = { ...filters };
    Object.keys(p).forEach((k) => {
      if (p[k] === '' || p[k] == null) delete p[k];
    });
    return p;
  }, [filters]);

  const { data, isLoading, isError, error } = useAppointmentList(params);
  const { data: doctorsData } = useDoctorList({ limit: 50 });
  const { data: branchesData } = useBranchList({ limit: 50 });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('appointments.title', 'Appointments')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('appointments.list.subtitle', 'Booking uses the Module 5 scheduling engine — never invents slots.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to={APP_ROUTES.APPOINTMENT_CALENDAR}>
              <CalendarDays className="h-4 w-4" />
              {t('appointments.calendar.title', 'Calendar')}
            </Link>
          </Button>
          <PermissionGuard permissions={[PERMISSIONS.APPOINTMENTS_CREATE, PERMISSIONS.APPOINTMENTS_ALL]}>
            <Button asChild>
              <Link to={APP_ROUTES.APPOINTMENT_BOOK}>
                <Plus className="h-4 w-4" />
                {t('appointments.list.book', 'Book')}
              </Link>
            </Button>
          </PermissionGuard>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder={t('appointments.list.searchPlaceholder', 'Search APT number…')}
          value={filters.search}
          onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value, page: 1 }))}
        />
        <Select
          value={filters.status}
          onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value, page: 1 }))}
        >
          <option value="">{t('appointments.list.allStatuses', 'All statuses')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{APPOINTMENT_STATUS_LABELS[s]}</option>
          ))}
        </Select>
        <Select
          value={filters.doctorId}
          onChange={(e) => setFilters((p) => ({ ...p, doctorId: e.target.value, page: 1 }))}
        >
          <option value="">{t('appointments.list.allDoctors', 'All doctors')}</option>
          {(doctorsData?.items || []).map((d) => (
            <option key={d.id} value={d.id}>{d.user?.fullName || d.doctorCode}</option>
          ))}
        </Select>
        <Select
          value={filters.branchId}
          onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value, page: 1 }))}
        >
          <option value="">{t('appointments.list.allBranches', 'All branches')}</option>
          {(branchesData?.items || []).map((b) => (
            <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
          ))}
        </Select>
        <Input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value, page: 1 }))}
        />
        <Input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value, page: 1 }))}
        />
      </div>

      {isError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error?.response?.data?.message || t('appointments.list.loadFailed', 'Failed to load appointments')}
        </p>
      )}

      <AppointmentTable items={data?.items || []} isLoading={isLoading} />
      <Pagination meta={data?.meta} onPageChange={(page) => setFilters((p) => ({ ...p, page }))} />
    </section>
  );
}
