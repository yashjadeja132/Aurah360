import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StaffForm } from '@/modules/users/components/StaffForm';
import { StepUpModal } from '@/modules/auth/components/StepUpModal';
import { useStaffDetail, useUpdateStaff } from '@/modules/users/hooks/useStaff';
import { staffDetailPath } from '@/constants/routes';

export default function StaffEditPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: user, isLoading, isError } = useStaffDetail(id);
  const updateStaff = useUpdateStaff(id);
  const [pendingPayload, setPendingPayload] = useState(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);

  const buildPayload = (values) => {
    const { password, ...rest } = values;
    return {
      ...rest,
      phone: rest.phone || null,
      gender: rest.gender || null,
      department: rest.department || null,
      designation: rest.designation || null,
      employeeId: rest.employeeId || null,
    };
  };

  const commitUpdate = async (payload, stepUpToken) => {
    try {
      await updateStaff.mutateAsync({ payload, stepUpToken });
      toast.success(t('users.edit.success'));
      navigate(staffDetailPath(id));
    } catch (err) {
      // SEC-002 — role/permission changes need a fresh step-up token; prompt for one and retry.
      if (err.response?.data?.code === 'STEP_UP_REQUIRED') {
        setPendingPayload(payload);
        setStepUpOpen(true);
        return;
      }
      toast.error(err.response?.data?.message || t('users.edit.failed'));
    }
  };

  const onSubmit = async (values) => {
    const payload = buildPayload(values);
    await commitUpdate(payload);
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (isError || !user) {
    return <p className="text-destructive">{t('users.edit.notFound')}</p>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('users.edit.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{user.fullName}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('users.edit.detailsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <StaffForm
            mode="edit"
            defaultValues={{
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              phone: user.phone || '',
              role: user.role === 'OWNER' ? 'ADMIN' : user.role,
              department: user.department || '',
              designation: user.designation || '',
              employeeId: user.employeeId || '',
              gender: user.gender || '',
              permissions: user.permissions || [],
            }}
            onSubmit={onSubmit}
            isSubmitting={updateStaff.isPending}
          />
        </CardContent>
      </Card>

      <StepUpModal
        open={stepUpOpen}
        onOpenChange={setStepUpOpen}
        title={t('users.edit.stepUpTitle', 'Confirm role/permission change')}
        description={t(
          'users.edit.stepUpDescription',
          'Changing a role or permissions is a sensitive action. Re-authenticate to continue.'
        )}
        onVerified={(stepUpToken) => {
          if (pendingPayload) commitUpdate(pendingPayload, stepUpToken);
          setPendingPayload(null);
        }}
      />
    </section>
  );
}
