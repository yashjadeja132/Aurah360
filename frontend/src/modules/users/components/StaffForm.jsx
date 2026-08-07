import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ROLE_OPTIONS, GENDER_OPTIONS } from '@/constants/rbac';
import { createStaffSchema, staffFormSchema } from '../validation/staffSchema';

export function StaffForm({
  mode = 'create',
  defaultValues,
  onSubmit,
  isSubmitting = false,
}) {
  const { t } = useTranslation();
  const schema = mode === 'create' ? createStaffSchema : staffFormSchema;

  const {
    register,
    handleSubmit,
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
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

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('users.form.saving') : mode === 'create' ? t('users.form.createStaff') : t('users.form.saveChanges')}
        </Button>
      </div>
    </form>
  );
}

export default StaffForm;
