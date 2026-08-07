import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BranchForm } from '@/modules/branches/components/BranchForm';
import { useBranchDetail, useBranchMutations } from '@/modules/branches/hooks/useBranches';
import { branchDetailPath } from '@/constants/routes';

export default function BranchEditPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: branch, isLoading, isError } = useBranchDetail(id);
  const { update } = useBranchMutations();

  const onSubmit = async (values) => {
    try {
      await update.mutateAsync({
        id,
        payload: {
          ...values,
          alternatePhone: values.alternatePhone || null,
          address: values.address || null,
          notes: values.notes || null,
        },
      });
      toast.success(t('settings.branches.edit.successToast', 'Branch updated'));
      navigate(branchDetailPath(id));
    } catch (err) {
      toast.error(err.response?.data?.message || t('settings.branches.edit.errorToast', 'Update failed'));
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !branch) return <p className="text-destructive">{t('settings.branches.edit.notFound', 'Branch not found.')}</p>;

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('settings.branches.edit.title', 'Edit branch')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{branch.displayName}</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{t('settings.branches.edit.detailsCard', 'Branch details')}</CardTitle></CardHeader>
        <CardContent>
          <BranchForm
            mode="edit"
            defaultValues={branch}
            onSubmit={onSubmit}
            isSubmitting={update.isPending}
          />
        </CardContent>
      </Card>
    </section>
  );
}
