import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PatientForm } from '@/modules/patients/components/PatientForm';
import { fromPatient } from '@/modules/patients/validation/patientSchema';
import { usePatientDetail, usePatientMutations } from '@/modules/patients/hooks/usePatients';
import { useBranchList } from '@/modules/branches/hooks/useBranches';
import { useDoctorList } from '@/modules/doctors/hooks/useDoctors';
import { useMasterActive } from '@/modules/masters/hooks/useMasters';
import { patientDetailPath } from '@/constants/routes';

export default function PatientEditPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: patient, isLoading } = usePatientDetail(id);
  const { update } = usePatientMutations();
  const { data: branchesData } = useBranchList({ limit: 50 });
  const { data: doctorsData } = useDoctorList({ limit: 50 });
  const { data: leadSources = [] } = useMasterActive('lead-sources');
  const { data: tags = [] } = useMasterActive('patient-tags');

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!patient) return <p className="text-destructive">{t('patients.detail.notFound', 'Patient not found.')}</p>;

  return (
    <section className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to={patientDetailPath(id)}>← {patient.mrn}</Link>
        </Button>
        <h1 className="font-display text-3xl font-semibold text-primary">
          {t('patients.edit.title', 'Edit patient')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{patient.fullName}</p>
      </div>
      <PatientForm
        defaultValues={fromPatient(patient)}
        onSubmit={async (payload) => {
          try {
            await update.mutateAsync({ id, payload });
            toast.success(t('patients.edit.updateSuccess', 'Patient updated'));
            navigate(patientDetailPath(id));
          } catch (err) {
            toast.error(err?.response?.data?.message || t('patients.edit.updateFailed', 'Update failed'));
          }
        }}
        isSubmitting={update.isPending}
        branches={branchesData?.items || []}
        doctors={doctorsData?.items || []}
        leadSources={leadSources}
        tagOptions={tags}
      />
    </section>
  );
}
