import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { GENDER_OPTIONS } from '@/constants/rbac';
import { patientFormSchema, toPatientPayload } from '../validation/patientSchema';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN'];
const MARITAL = ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', 'OTHER'];

// Common presets so staff pick instead of typing. "Other" reveals a text box.
const OCCUPATIONS = ['Housewife', 'Student', 'Business', 'Service / Job', 'Software / IT', 'Doctor', 'Teacher', 'Farmer', 'Labour', 'Retired'];
const YES_NO = ['No', 'Occasionally', 'Yes'];
const ALLERGY_PRESETS = ['None known', 'Penicillin', 'Sulfa drugs', 'Aspirin / NSAIDs', 'Food allergy', 'Dust / pollen'];
const CHRONIC_PRESETS = ['None', 'Diabetes', 'Hypertension (BP)', 'Thyroid', 'Asthma', 'PCOD / PCOS', 'Heart disease'];
const PREGNANCY_PRESETS = ['Not pregnant', 'Pregnant', 'Breastfeeding', 'Trying to conceive'];

function Field({ label, error, children }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/**
 * Dropdown that also accepts a custom value. Staff pick a preset; choosing
 * "Other…" reveals a text box. Stored as a plain string via react-hook-form,
 * so it works for both preset and free-typed values with no schema change.
 */
function ComboField({ label, value, onChange, options, placeholder }) {
  const isPreset = value === '' || options.includes(value);
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select
        value={isPreset ? value : '__other__'}
        onChange={(e) => onChange(e.target.value === '__other__' ? ' ' : e.target.value)}
      >
        <option value="">{placeholder || 'Select…'}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
        <option value="__other__">Other (type)…</option>
      </Select>
      {!isPreset && (
        <Input
          autoFocus
          value={value.trim() === '' ? '' : value}
          placeholder="Type here…"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
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
  const gender = watch('gender');
  const isFemale = gender === 'FEMALE';
  const combo = (name) => ({ value: watch(name) || '', onChange: (v) => setValue(name, v) });

  // A male/other patient can't be pregnant — drop any value so it never saves.
  useEffect(() => {
    if (!isFemale) setValue('pregnancyStatus', '');
  }, [isFemale, setValue]);

  const toggleTag = (name) => {
    if (tags.includes(name)) setValue('tags', tags.filter((tag) => tag !== name));
    else setValue('tags', [...tags, name]);
  };

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
          <ComboField label={t('patients.form.occupation', 'Occupation')} options={OCCUPATIONS} placeholder="Select occupation…" {...combo('occupation')} />
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
          <ComboField label={t('patients.form.allergies', 'Allergies')} options={ALLERGY_PRESETS} placeholder="Select / type…" {...combo('allergies')} />
          <ComboField label={t('patients.form.chronicDiseases', 'Chronic diseases')} options={CHRONIC_PRESETS} placeholder="Select / type…" {...combo('chronicDiseases')} />
          <Field label={t('patients.form.pastMedicalHistory', 'Past medical history')}><Input {...register('pastMedicalHistory')} /></Field>
          <Field label={t('patients.form.pastSurgicalHistory', 'Past surgical history')}><Input {...register('pastSurgicalHistory')} /></Field>
          <Field label={t('patients.form.currentMedications', 'Current medications')}><Input {...register('currentMedications')} /></Field>
          <ComboField label={t('patients.form.smoking', 'Smoking')} options={YES_NO} placeholder="Select…" {...combo('smoking')} />
          <ComboField label={t('patients.form.alcohol', 'Alcohol')} options={YES_NO} placeholder="Select…" {...combo('alcohol')} />
          {/* Pregnancy only applies to female patients — hidden otherwise. */}
          {isFemale && (
            <ComboField label={t('patients.form.pregnancyStatus', 'Pregnancy status')} options={PREGNANCY_PRESETS} placeholder="Select…" {...combo('pregnancyStatus')} />
          )}
          <Field label={t('patients.form.generalNotes', 'General notes')}><Input {...register('generalNotes')} /></Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-primary">
          {t('patients.form.sections.clinic', 'Clinic')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('patients.form.primaryBranch', 'Primary branch')} error={errors.primaryBranchId?.message}>
            <Select {...register('primaryBranchId')}>
              <option value="">{t('patients.form.selectBranch', 'Select branch')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t('patients.form.primaryDoctor', 'Primary doctor')}>
            <Select {...register('primaryDoctorId')}>
              <option value="">{t('patients.form.optional', 'Optional')}</option>
              {doctors.map((d) => (
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
