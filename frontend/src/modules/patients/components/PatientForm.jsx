import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { GENDER_OPTIONS, ROLES } from '@/constants/rbac';
import { useAuth } from '@/contexts/AuthContext';
import { patientFormSchema, toPatientPayload } from '../validation/patientSchema';

// Mirrors backend/src/helpers/scope.helper.js#GLOBAL_SCOPE_ROLES — same reasoning as
// QuickAddPatientDialog's branch field. A branch-scoped staff member only ever registers/edits
// patients at their own branch, so the primary-branch field is locked for them here too.
const GLOBAL_SCOPE_ROLES = [ROLES.OWNER, ROLES.ADMIN];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'];
const MARITAL = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER'];

function Field({ label, error, children }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function PatientForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  branches = [],
  doctors = [],
  leadSources = [],
  tagOptions = [],
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isGlobalScope = GLOBAL_SCOPE_ROLES.includes(user?.role);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      gender: 'MALE',
      mobile: '',
      primaryBranchId: '',
      tags: [],
      country: 'India',
      nationality: 'Indian',
      preferredLanguage: 'en',
      privacyPolicy: true,
      treatmentConsent: true,
      ...defaultValues,
    },
  });

  const tags = watch('tags') || [];
  const primaryBranchId = watch('primaryBranchId');
  const primaryDoctorId = watch('primaryDoctorId');

  const toggleTag = (name) => {
    if (tags.includes(name)) setValue('tags', tags.filter((tag) => tag !== name));
    else setValue('tags', [...tags, name]);
  };

  // The doctor list must reflect who actually practices at the SELECTED branch, not every
  // doctor in the org — Doctor.branches (an array of branch ids, already returned by
  // useDoctorList) is the source of truth. Before a branch is picked there's nothing to filter
  // against yet, so show the full list rather than an empty one.
  const doctorsForSelectedBranch = useMemo(() => {
    if (!primaryBranchId) return doctors;
    return doctors.filter((d) => (d.branches || []).includes(primaryBranchId));
  }, [doctors, primaryBranchId]);

  // If the branch changes and the currently-selected doctor no longer practices there, clear
  // it — keeping a doctor selected who doesn't work at the newly-chosen branch would silently
  // save a mismatched primaryBranchId/primaryDoctorId pair.
  useEffect(() => {
    if (primaryDoctorId && !doctorsForSelectedBranch.some((d) => d.id === primaryDoctorId)) {
      setValue('primaryDoctorId', '');
    }
  }, [doctorsForSelectedBranch, primaryDoctorId, setValue]);

  // Branch-scoped roles never get to pick a branch here — pre-fill their own the moment it's
  // known (registration) and leave an existing patient's branch untouched (edit).
  useEffect(() => {
    if (!isGlobalScope && !primaryBranchId && user?.branch) {
      setValue('primaryBranchId', user.branch);
    }
  }, [isGlobalScope, primaryBranchId, user?.branch, setValue]);

  return (
    <form
      className="space-y-8"
      onSubmit={handleSubmit((values) => onSubmit(toPatientPayload(values)))}
      noValidate
    >
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-primary">
          {t('patients.form.sections.basicInfo', 'Basic information')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('patients.form.firstName', 'First name')} error={errors.firstName?.message}>
            <Input {...register('firstName')} />
          </Field>
          <Field label={t('patients.form.middleName', 'Middle name')}>
            <Input {...register('middleName')} />
          </Field>
          <Field label={t('patients.form.lastName', 'Last name')} error={errors.lastName?.message}>
            <Input {...register('lastName')} />
          </Field>
          <Field label={t('patients.form.gender', 'Gender')} error={errors.gender?.message}>
            <Select {...register('gender')}>
              {GENDER_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('patients.form.dob', 'Date of birth')}>
            <Input type="date" {...register('dateOfBirth')} />
          </Field>
          <Field label={t('patients.form.bloodGroup', 'Blood group')}>
            <Select {...register('bloodGroup')}>
              <option value="">—</option>
              {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
          </Field>
          <Field label={t('patients.form.maritalStatus', 'Marital status')}>
            <Select {...register('maritalStatus')}>
              <option value="">—</option>
              {MARITAL.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label={t('patients.form.mobile', 'Mobile')} error={errors.mobile?.message}>
            <Input {...register('mobile')} />
          </Field>
          <Field label={t('patients.form.altMobile', 'Alternate mobile')}>
            <Input {...register('alternateMobile')} />
          </Field>
          <Field label={t('patients.form.email', 'Email')} error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </Field>
          <Field label={t('patients.form.occupation', 'Occupation')}>
            <Input {...register('occupation')} />
          </Field>
          <Field label={t('patients.form.nationality', 'Nationality')}>
            <Input {...register('nationality')} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-primary">
          {t('patients.form.sections.address', 'Address')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('patients.form.addressLine1', 'Address line 1')}><Input {...register('addressLine1')} /></Field>
          <Field label={t('patients.form.addressLine2', 'Address line 2')}><Input {...register('addressLine2')} /></Field>
          <Field label={t('patients.form.city', 'City')}><Input {...register('city')} /></Field>
          <Field label={t('patients.form.state', 'State')}><Input {...register('state')} /></Field>
          <Field label={t('patients.form.country', 'Country')}><Input {...register('country')} /></Field>
          <Field label={t('patients.form.postalCode', 'Postal code')}><Input {...register('postalCode')} /></Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-primary">
          {t('patients.form.sections.emergencyContact', 'Emergency contact')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('patients.form.emergencyName', 'Name')}><Input {...register('emergencyName')} /></Field>
          <Field label={t('patients.form.emergencyRelationship', 'Relationship')}><Input {...register('emergencyRelationship')} /></Field>
          <Field label={t('patients.form.emergencyPhone', 'Phone')}><Input {...register('emergencyPhone')} /></Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-primary">
          {t('patients.form.sections.medical', 'Medical')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('patients.form.height', 'Height (cm)')}><Input {...register('heightCm')} /></Field>
          <Field label={t('patients.form.weight', 'Weight (kg)')}><Input {...register('weightKg')} /></Field>
          <Field label={t('patients.form.allergies', 'Allergies')}><Input {...register('allergies')} /></Field>
          <Field label={t('patients.form.chronicDiseases', 'Chronic diseases')}><Input {...register('chronicDiseases')} /></Field>
          <Field label={t('patients.form.pastMedicalHistory', 'Past medical history')}><Input {...register('pastMedicalHistory')} /></Field>
          <Field label={t('patients.form.pastSurgicalHistory', 'Past surgical history')}><Input {...register('pastSurgicalHistory')} /></Field>
          <Field label={t('patients.form.currentMedications', 'Current medications')}><Input {...register('currentMedications')} /></Field>
          <Field label={t('patients.form.smoking', 'Smoking')}><Input {...register('smoking')} /></Field>
          <Field label={t('patients.form.alcohol', 'Alcohol')}><Input {...register('alcohol')} /></Field>
          <Field label={t('patients.form.pregnancyStatus', 'Pregnancy status')}><Input {...register('pregnancyStatus')} /></Field>
          <Field label={t('patients.form.generalNotes', 'General notes')}><Input {...register('generalNotes')} /></Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-primary">
          {t('patients.form.sections.clinic', 'Clinic')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('patients.form.primaryBranch', 'Primary branch')} error={errors.primaryBranchId?.message}>
            <Select {...register('primaryBranchId')} disabled={!isGlobalScope}>
              <option value="">{t('patients.form.selectBranch', 'Select branch')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('patients.form.primaryDoctor', 'Primary doctor')}>
            <Select {...register('primaryDoctorId')}>
              <option value="">{t('patients.form.optional', 'Optional')}</option>
              {doctorsForSelectedBranch.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.user?.fullName || d.doctorCode} ({d.doctorCode})
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('patients.form.leadSource', 'Lead source')}>
            <Select {...register('leadSourceId')}>
              <option value="">—</option>
              {leadSources.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('patients.form.referredBy', 'Referred by')}><Input {...register('referredBy')} /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" {...register('isVip')} />
            {t('patients.form.vipPatient', 'VIP patient')}
          </label>
        </div>
        <div>
          <Label>{t('patients.form.tagsLabel', 'Tags')}</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {tagOptions.map((tg) => (
              <button
                key={tg.id || tg.name}
                type="button"
                onClick={() => toggleTag(tg.name)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  tags.includes(tg.name)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                {tg.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-primary">
          {t('patients.form.sections.consent', 'Consent')}
        </h2>
        {[
          ['privacyPolicy', t('patients.form.consentPrivacy', 'Privacy policy')],
          ['treatmentConsent', t('patients.form.consentTreatment', 'Treatment consent')],
          ['communicationConsent', t('patients.form.consentCommunication', 'Communication consent')],
          ['photographyConsent', t('patients.form.consentPhotography', 'Photography consent')],
          ['marketingConsent', t('patients.form.consentMarketing', 'Marketing consent')],
        ].map(([name, label]) => (
          <label key={name} className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register(name)} />
            {label}
          </label>
        ))}
      </section>

      <Field label={t('common.notes', 'Notes')}><Input {...register('notes')} /></Field>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('patients.form.saving', 'Saving…') : t('patients.form.save', 'Save patient')}
      </Button>
    </form>
  );
}

export default PatientForm;
