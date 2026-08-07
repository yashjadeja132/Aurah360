import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { PatientForm } from '@/modules/patients/components/PatientForm';
import { usePatientMutations } from '@/modules/patients/hooks/usePatients';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useMasterActive } from '@/modules/masters/hooks/useMasters';
import { APP_ROUTES, patientDetailPath } from '@/constants/routes';

export default function PatientCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { create, checkDuplicates } = usePatientMutations();
  const { data: branchesData } = useBranchList({ limit: 50 });
  const { data: doctorsData } = useDoctorList({ limit: 50, isActive: 'true' });
  const { data: leadSources = [] } = useMasterActive('lead-sources');
  const { data: tags = [] } = useMasterActive('patient-tags');

  const onSubmit = async (payload) => {
    try {
      try {
        const dupRes = await checkDuplicates.mutateAsync({
          mobile: payload.mobile,
          email: payload.email || undefined,
          firstName: payload.firstName,
          lastName: payload.lastName,
          dateOfBirth: payload.dateOfBirth || undefined,
        });
        const matches = dupRes?.data?.matches || [];
        if (matches.length) {
          const ok = window.confirm(
            t('patients.create.duplicateConfirm', {
              defaultValue: '{{count}} possible duplicate(s) found. Continue creating anyway?',
              count: matches.length,
            })
          );
          if (!ok) return;
        }
      } catch {
        /* duplicate check is advisory */
      }

      const res = await create.mutateAsync(payload);
      toast.success(
        t('patients.create.createSuccess', {
          defaultValue: 'Patient created · {{mrn}}',
          mrn: res.data.patient.mrn,
        })
      );
      navigate(patientDetailPath(res.data.patient.id));
    } catch (err) {
      toast.error(
        err?.response?.data?.message || t('patients.create.createFailed', 'Failed to create patient')
      );
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to={APP_ROUTES.PATIENTS}>← {t('nav.patients', 'Patients')}</Link>
        </Button>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('patients.create.title', 'Register patient')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('patients.create.mrnHint', 'MRN is generated automatically.')}
        </p>
      </div>
      <PatientForm
        onSubmit={onSubmit}
        isSubmitting={create.isPending}
        branches={branchesData?.items || []}
        doctors={doctorsData?.items || []}
        leadSources={leadSources}
        tagOptions={tags}
      />
    </section>
  );
}
