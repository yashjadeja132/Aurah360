import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { usePatientMe, useUpdatePatientProfile } from '@/modules/patientPortal/hooks/usePatientPortal';
import { patientPortalApi } from '@/modules/patientPortal/api/patientApi';

export default function PatientProfilePage() {
  const { t } = useTranslation();
  const { data: patient } = usePatientMe();
  const update = useUpdatePatientProfile();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    alternateMobile: '',
    email: '',
    occupation: '',
  });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' });

  useEffect(() => {
    if (patient) {
      setForm({
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        alternateMobile: patient.alternateMobile || '',
        email: patient.email || '',
        occupation: patient.occupation || '',
      });
    }
  }, [patient]);

  const fieldLabels = {
    firstName: t('portal.profile.fields.firstName', 'First Name'),
    lastName: t('portal.profile.fields.lastName', 'Last Name'),
    email: t('portal.profile.fields.email', 'Email'),
    alternateMobile: t('portal.profile.fields.alternateMobile', 'Alternate Mobile'),
    occupation: t('portal.profile.fields.occupation', 'Occupation'),
  };

  return (
    <section className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-teal-950">{t('portal.profile.title', 'My profile')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('portal.profile.mrnLabel', 'MRN')} {patient?.mrn} · {t('portal.profile.updateDetailsHint', 'update personal details')}
        </p>
      </div>

      <form
        className="grid max-w-xl gap-3 rounded-xl border bg-white/80 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await update.mutateAsync(form);
            toast.success(t('portal.profile.updateSuccess', 'Profile updated'));
          } catch (err) {
            toast.error(err?.response?.data?.message || t('portal.profile.updateFailed', 'Update failed'));
          }
        }}
      >
        {['firstName', 'lastName', 'email', 'alternateMobile', 'occupation'].map((k) => (
          <label key={k} className="space-y-1 text-sm">
            <span className="capitalize">{fieldLabels[k]}</span>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </label>
        ))}
        <Button type="submit" className="bg-teal-800 hover:bg-teal-900">
          {t('portal.profile.saveProfile', 'Save profile')}
        </Button>
      </form>

      {patient?.emergencyContact && (
        <div className="rounded-xl border bg-white/80 p-4 text-sm">
          <h2 className="font-semibold">{t('portal.profile.emergencyContact', 'Emergency contact')}</h2>
          <p className="mt-1 text-muted-foreground">
            {patient.emergencyContact.name || '—'} · {patient.emergencyContact.phone || '—'}
          </p>
        </div>
      )}

      <form
        className="grid max-w-xl gap-3 rounded-xl border bg-white/80 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await patientPortalApi.changePassword(pwd);
            toast.success(t('portal.profile.passwordChanged', 'Password changed — please sign in again'));
            setPwd({ currentPassword: '', newPassword: '' });
          } catch (err) {
            toast.error(err?.response?.data?.message || t('portal.profile.passwordChangeFailed', 'Password change failed'));
          }
        }}
      >
        <h2 className="font-semibold">{t('portal.profile.changePassword', 'Change password')}</h2>
        <input
          type="password"
          placeholder={t('portal.profile.currentPasswordPlaceholder', 'Current password')}
          className="rounded-md border px-3 py-2"
          value={pwd.currentPassword}
          onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder={t('portal.profile.newPasswordPlaceholder', 'New password (min 8)')}
          className="rounded-md border px-3 py-2"
          value={pwd.newPassword}
          onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })}
          required
          minLength={8}
        />
        <Button type="submit" variant="outline">
          {t('portal.profile.updatePassword', 'Update password')}
        </Button>
      </form>
    </section>
  );
}
