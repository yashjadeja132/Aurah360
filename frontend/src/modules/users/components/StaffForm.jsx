import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ROLE_OPTIONS, GENDER_OPTIONS } from '@/constants/rbac';
import { usePermissionsCatalogue, useRoleTemplates } from '../hooks/useStaff';
import { createStaffSchema, staffFormSchema } from '../validation/staffSchema';

/**
 * §2.1 — role-template staff creation. When the admin picks (or changes) a role, the toggle set
 * is pre-checked from that role's existing default permission array (constants/rolePermissions.js
 * on the backend, surfaced via GET /roles/templates) — no new templates invented here. The admin
 * can still tick/untick individual permissions before saving.
 */
function PermissionToggles({ role, value, onChange }) {
  const { t } = useTranslation();
  const { data: catalogue = [], isLoading: catalogueLoading } = usePermissionsCatalogue();
  const { data: templates = {}, isLoading: templatesLoading } = useRoleTemplates();
  const lastAppliedRole = useRef(null);

  const grouped = useMemo(() => {
    const byModule = {};
    catalogue.forEach((p) => {
      byModule[p.module] = byModule[p.module] || [];
      byModule[p.module].push(p);
    });
    return byModule;
  }, [catalogue]);

  // Re-apply the role's default bundle whenever the admin switches roles (not on every render,
  // and not clobbering manual edits made after the role was picked).
  useEffect(() => {
    if (!role || templatesLoading) return;
    if (lastAppliedRole.current === role) return;
    lastAppliedRole.current = role;
    onChange(templates[role] || []);
  }, [role, templates, templatesLoading, onChange]);

  const toggle = (key) => {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  };

  if (catalogueLoading || templatesLoading) {
    return <p className="text-sm text-muted-foreground">{t('users.form.loadingPermissions', 'Loading permission set…')}</p>;
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">
        {t(
          'users.form.permissionsHint',
          'Pre-filled from the {{role}} default permission set — adjust as needed before saving.',
          { role }
        )}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(grouped).map(([module, perms]) => (
          <div key={module} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{module}</p>
            {perms.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={value.includes(p.key)}
                  onChange={() => toggle(p.key)}
                  className="h-4 w-4 rounded border-input"
                />
                <span title={p.description}>{p.key}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function StaffForm({
  mode = 'create',
  defaultValues,
  onSubmit,
  isSubmitting = false,
}) {
  const { t } = useTranslation();
  const schema = mode === 'create' ? createStaffSchema : staffFormSchema;
  const [permissions, setPermissions] = useState(defaultValues?.permissions || []);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      role: 'RECEPTIONIST',
      department: '',
      designation: '',
      employeeId: '',
      gender: '',
      ...defaultValues,
    },
  });

  const selectedRole = watch('role');

  const submitWithPermissions = (values) => onSubmit({ ...values, permissions });

  return (
    <form onSubmit={handleSubmit(submitWithPermissions)} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="firstName">{t('users.form.firstNameLabel')}</Label>
          <Input id="firstName" {...register('firstName')} />
          {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">{t('users.form.lastNameLabel')}</Label>
          <Input id="lastName" {...register('lastName')} />
          {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">{t('users.form.emailLabel')}</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{t('users.form.phoneLabel')}</Label>
          <Input id="phone" {...register('phone')} />
        </div>
      </div>

      {mode === 'create' && (
        <div className="space-y-2">
          <Label htmlFor="password">{t('users.form.passwordLabel')}</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
          {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="role">{t('users.form.roleLabel')}</Label>
          <Select id="role" {...register('role')}>
            {ROLE_OPTIONS.map((role) => (
              <option key={role.value} value={role.value}>{role.label}</option>
            ))}
          </Select>
          {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">{t('users.form.genderLabel')}</Label>
          <Select id="gender" {...register('gender')}>
            <option value="">{t('users.form.selectPlaceholder')}</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="employeeId">{t('users.form.employeeIdLabel')}</Label>
          <Input id="employeeId" {...register('employeeId')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="department">{t('users.form.departmentLabel')}</Label>
          <Input id="department" {...register('department')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="designation">{t('users.form.designationLabel')}</Label>
          <Input id="designation" {...register('designation')} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t('users.form.permissionsLabel', 'Permissions')}</Label>
        <PermissionToggles role={selectedRole} value={permissions} onChange={setPermissions} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('users.form.saving') : mode === 'create' ? t('users.form.createStaff') : t('users.form.saveChanges')}
        </Button>
      </div>
    </form>
  );
}

export default StaffForm;
