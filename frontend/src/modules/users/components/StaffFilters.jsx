import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ROLE_OPTIONS } from '@/constants/rbac';

export function StaffFilters({ filters, onChange }) {
  const { t } = useTranslation();
  const set = (key, value) => onChange({ ...filters, [key]: value, page: 1 });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Input
        placeholder={t('users.filters.searchPlaceholder')}
        value={filters.search || ''}
        onChange={(e) => set('search', e.target.value)}
      />
      <Select
        value={filters.role || ''}
        onChange={(e) => set('role', e.target.value || undefined)}
      >
        <option value="">{t('users.filters.allRoles')}</option>
        <option value="OWNER">{t('users.filters.ownerRole')}</option>
        {ROLE_OPTIONS.map((role) => (
          <option key={role.value} value={role.value}>{role.label}</option>
        ))}
      </Select>
      <Select
        value={filters.isActive || ''}
        onChange={(e) => set('isActive', e.target.value || undefined)}
      >
        <option value="">{t('users.filters.allStatuses')}</option>
        <option value="true">{t('users.filters.active')}</option>
        <option value="false">{t('users.filters.inactive')}</option>
      </Select>
      <Select
        value={filters.sortBy || 'createdAt'}
        onChange={(e) => set('sortBy', e.target.value)}
      >
        <option value="createdAt">{t('users.filters.sortNewest')}</option>
        <option value="firstName">{t('users.filters.sortFirstName')}</option>
        <option value="lastName">{t('users.filters.sortLastName')}</option>
        <option value="role">{t('users.filters.sortRole')}</option>
        <option value="lastLogin">{t('users.filters.sortLastLogin')}</option>
      </Select>
    </div>
  );
}

export default StaffFilters;
