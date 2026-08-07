import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BranchForm } from '@/modules/branches/components/BranchForm';
import { useBranchMutations } from '@/modules/branches/hooks/useBranches';
import { branchDetailPath } from '@/constants/routes';

export default function BranchCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { create } = useBranchMutations();

  const onSubmit = async (values) => {
    try {
      const res = await create.mutateAsync({
        ...values,
        alternatePhone: values.alternatePhone || null,
        address: values.address || null,
        notes: values.notes || null,
      });
      toast.success(t('settings.branches.create.successToast', 'Branch created'));
      navigate(branchDetailPath(res.data.branch.id));
    } catch (err) {
      toast.error(err.response?.data?.message || t('settings.branches.create.errorToast', 'Create failed'));
    }
  };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('settings.branches.create.title', 'Add branch')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.branches.create.description', 'Create a new Aurah 360 location.')}</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{t('settings.branches.create.detailsCard', 'Branch details')}</CardTitle></CardHeader>
        <CardContent>
          <BranchForm mode="create" onSubmit={onSubmit} isSubmitting={create.isPending} />
        </CardContent>
      </Card>
    </section>
  );
}
