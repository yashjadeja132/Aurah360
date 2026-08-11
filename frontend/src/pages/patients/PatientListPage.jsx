import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pagination } from '@/components/common/Pagination';
import { PermissionGuard } from '@/components/common/PermissionGuard';
import { PatientTable } from '@/modules/patients/components/PatientTable';
import { usePatientList } from '@/modules/patients/hooks/usePatients';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useClinicId } from '@/stores/clinicStore';
import { useMasterActive } from '@/modules/masters/hooks/useMasters';
import { APP_ROUTES } from '@/constants/routes';
import { PERMISSIONS, GENDER_OPTIONS } from '@/constants/rbac';

export default function PatientListPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    gender: '',
    branchId: '',
    leadSourceId: '',
    isVip: '',
    tag: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const params = useMemo(() => {
    const p = { ...filters };
    Object.keys(p).forEach((k) => {
      if (p[k] === '' || p[k] == null) delete p[k];
    });
    return p;
  }, [filters]);

  const { data, isLoading, isError, error } = usePatientList(params);
  const { data: branchesData } = useBranchList({ limit: 50 });
  const clinicId = useClinicId();
  useEffect(() => {
    setFilters((p) => (p.branchId === clinicId ? p : { ...p, branchId: clinicId, page: 1 }));
  }, [clinicId]);
  const { data: leadSources = [] } = useMasterActive('lead-sources');
  const { data: tags = [] } = useMasterActive('patient-tags');

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-primary">
            {t('patients.list.title', 'Patients')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('patients.list.subtitle', 'Central patient registry for Aurah 360 ClinicOS.')}
          </p>
        </div>
        <PermissionGuard permissions={[PERMISSIONS.PATIENTS_CREATE, PERMISSIONS.PATIENTS_ALL]}>
          <Button asChild>
            <Link to={APP_ROUTES.PATIENT_CREATE}>
              <Plus className="h-4 w-4" />
              {t('patients.list.registerPatient', 'Register patient')}
            </Link>
          </Button>
        </PermissionGuard>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder={t('patients.list.searchPlaceholder', 'Search MRN, name, phone, email…')}
          value={filters.search}
          onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value, page: 1 }))}
        />
        <Select
          value={filters.branchId}
          onChange={(e) => setFilters((p) => ({ ...p, branchId: e.target.value, page: 1 }))}
        >
          <option value="">{t('patients.list.allBranches', 'All branches')}</option>
          {(branchesData?.items || []).map((b) => (
            <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
          ))}
        </Select>
        <Select
          value={filters.gender}
          onChange={(e) => setFilters((p) => ({ ...p, gender: e.target.value, page: 1 }))}
        >
          <option value="">{t('patients.list.allGenders', 'All genders')}</option>
          {GENDER_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </Select>
        <Select
          value={filters.leadSourceId}
          onChange={(e) => setFilters((p) => ({ ...p, leadSourceId: e.target.value, page: 1 }))}
        >
          <option value="">{t('patients.list.allLeadSources', 'All lead sources')}</option>
          {leadSources.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select
          value={filters.isVip}
          onChange={(e) => setFilters((p) => ({ ...p, isVip: e.target.value, page: 1 }))}
        >
          <option value="">{t('patients.list.vipAny', 'VIP: any')}</option>
          <option value="true">{t('patients.list.vipOnly', 'VIP only')}</option>
          <option value="false">{t('patients.list.nonVip', 'Non-VIP')}</option>
        </Select>
        <Select
          value={filters.tag}
          onChange={(e) => setFilters((p) => ({ ...p, tag: e.target.value, page: 1 }))}
        >
          <option value="">{t('patients.list.allTags', 'All tags')}</option>
          {tags.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </Select>
        <Select
          value={filters.sortBy}
          onChange={(e) => setFilters((p) => ({ ...p, sortBy: e.target.value }))}
        >
          <option value="createdAt">{t('patients.list.sortNewest', 'Newest')}</option>
          <option value="registrationDate">{t('patients.list.sortRegistration', 'Registration')}</option>
          <option value="firstName">{t('patients.list.sortFirstName', 'First name')}</option>
          <option value="mrn">{t('patients.list.sortMrn', 'MRN')}</option>
        </Select>
      </div>

      {isError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error?.response?.data?.message || t('patients.list.loadFailed', 'Failed to load patients')}
        </p>
      )}

      <PatientTable items={data?.items || []} isLoading={isLoading} />
      <Pagination meta={data?.meta} onPageChange={(page) => setFilters((p) => ({ ...p, page }))} />
    </section>
  );
}
