import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { doctorFormSchema } from '../validation/doctorSchema';
import { GENDER_OPTIONS } from '@/constants/rbac';

function MultiCheckbox({ options, value = [], onChange, emptyLabel }) {
  const toggle = (id) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  return (
    <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
      {options.map((opt) => (
        <label key={opt.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.includes(opt.id)}
            onChange={() => toggle(opt.id)}
          />
          {opt.label}
        </label>
      ))}
      {!options.length && <p className="text-xs text-muted-foreground">{emptyLabel}</p>}
    </div>
  );
}

export function DoctorForm({
  mode = 'create',
  defaultValues,
  onSubmit,
  isSubmitting,
  users = [],
  branches = [],
  departments = [],
  services = [],
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(doctorFormSchema),
    defaultValues: {
      userId: '',
      doctorCode: '',
      licenseNumber: '',
      registrationNumber: '',
      qualification: '',
      specialization: '',
      experienceYears: 0,
      consultationDuration: 15,
      consultationFee: 0,
      followUpFee: 0,
      branches: [],
      departments: [],
      services: [],
      languages: 'en,gu,hi',
      gender: '',
      colorCode: '#2563eb',
      isAvailableOnline: false,
      bio: '',
      notes: '',
      ...defaultValues,
    },
  });

  const branchesValue = watch('branches') || [];
  const departmentsValue = watch('departments') || [];
  const servicesValue = watch('services') || [];

  return (
    <form
      className="space-y-5"
      onSubmit={handleSubmit((values) =>
        onSubmit({
          ...values,
          languages: String(values.languages || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          gender: values.gender || null,
        })
      )}
      noValidate
    >
      {mode === 'create' && (
        <div className="space-y-2">
          <Label>{t('doctors.form.linkedUser', 'Linked user (DOCTOR role)')}</Label>
          <Select {...register('userId')}>
            <option value="">{t('doctors.form.selectUser', 'Select user')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName} · {u.email}
              </option>
            ))}
          </Select>
          {errors.userId && <p className="text-sm text-destructive">{errors.userId.message}</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('doctors.form.doctorCode', 'Doctor code')} error={errors.doctorCode}>
          <Input {...register('doctorCode')} disabled={mode === 'edit'} />
        </Field>
        <Field label={t('doctors.form.licenseNumber', 'License no.')} error={errors.licenseNumber}>
          <Input {...register('licenseNumber')} />
        </Field>
        <Field label={t('doctors.form.registrationNumber', 'Registration no.')} error={errors.registrationNumber}>
          <Input {...register('registrationNumber')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('doctors.form.qualification', 'Qualification')}><Input {...register('qualification')} /></Field>
        <Field label={t('doctors.form.specialization', 'Specialization')}><Input {...register('specialization')} /></Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={t('doctors.form.experienceYears', 'Experience (yrs)')}><Input type="number" {...register('experienceYears')} /></Field>
        <Field label={t('doctors.form.consultDuration', 'Consult duration')}><Input type="number" {...register('consultationDuration')} /></Field>
        <Field label={t('doctors.form.consultFee', 'Consult fee')}><Input type="number" {...register('consultationFee')} /></Field>
        <Field label={t('doctors.form.followUpFee', 'Follow-up fee')}><Input type="number" {...register('followUpFee')} /></Field>
      </div>

      <div className="space-y-2">
        <Label>{t('doctors.form.branches', 'Branches')}</Label>
        <MultiCheckbox
          options={branches.map((b) => ({ id: b.id, label: b.displayName || b.name }))}
          value={branchesValue}
          onChange={(v) => setValue('branches', v, { shouldValidate: true })}
          emptyLabel={t('doctors.form.noOptionsLoaded', 'No options loaded')}
        />
        {errors.branches && <p className="text-sm text-destructive">{errors.branches.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>{t('doctors.form.departments', 'Departments')}</Label>
        <MultiCheckbox
          options={departments.map((d) => ({ id: d.id, label: d.name }))}
          value={departmentsValue}
          onChange={(v) => setValue('departments', v)}
          emptyLabel={t('doctors.form.noOptionsLoaded', 'No options loaded')}
        />
      </div>

      <div className="space-y-2">
        <Label>{t('doctors.form.services', 'Services')}</Label>
        <MultiCheckbox
          options={services.map((s) => ({ id: s.id, label: s.name }))}
          value={servicesValue}
          onChange={(v) => setValue('services', v)}
          emptyLabel={t('doctors.form.noOptionsLoaded', 'No options loaded')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('doctors.form.languages', 'Languages (comma-separated)')}><Input {...register('languages')} /></Field>
        <Field label={t('doctors.form.gender', 'Gender')}>
          <Select {...register('gender')}>
            <option value="">{t('doctors.form.selectGender', 'Select')}</option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('doctors.form.color', 'Color')}><Input type="color" {...register('colorCode')} /></Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('isAvailableOnline')} />
        {t('doctors.form.availableOnline', 'Available for online consult')}
      </label>

      <Field label={t('doctors.form.bio', 'Bio')}><Input {...register('bio')} /></Field>
      <Field label={t('doctors.form.notes', 'Notes')}><Input {...register('notes')} /></Field>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('doctors.form.saving', 'Saving…') : mode === 'create' ? t('doctors.form.createDoctor', 'Create doctor') : t('doctors.form.saveChanges', 'Save changes')}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, error, children }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error.message}</p>}
    </div>
  );
}

export default DoctorForm;
