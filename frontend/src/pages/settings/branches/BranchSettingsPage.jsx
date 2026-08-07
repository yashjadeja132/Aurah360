import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBranchDetail, useBranchMutations } from '@/modules/branches/hooks/useBranches';
import { branchDetailPath } from '@/constants/routes';

export default function BranchSettingsPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: branch, isLoading, isError } = useBranchDetail(id);
  const { updateSettings } = useBranchMutations();
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    if (!branch?.settings) return;
    reset({
      timeSlotDurationMinutes: branch.settings.timeSlotDurationMinutes ?? 15,
      appointmentBufferMinutes: branch.settings.appointmentBufferMinutes ?? 5,
      lunchEnabled: branch.settings.lunchBreak?.enabled ?? true,
      lunchStart: branch.settings.lunchBreak?.startTime || '13:00',
      lunchEnd: branch.settings.lunchBreak?.endTime || '14:00',
      workingDays: (branch.settings.workingDays || []).join(','),
      emergencyName: branch.settings.emergencyContact?.name || '',
      emergencyPhone: branch.settings.emergencyContact?.phone || '',
      emergencyEmail: branch.settings.emergencyContact?.email || '',
    });
  }, [branch, reset]);

  const onSubmit = async (values) => {
    try {
      const workingDays = String(values.workingDays || '')
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 6);

      await updateSettings.mutateAsync({
        id,
        payload: {
          timeSlotDurationMinutes: Number(values.timeSlotDurationMinutes),
          appointmentBufferMinutes: Number(values.appointmentBufferMinutes),
          workingDays,
          lunchBreak: {
            enabled: Boolean(values.lunchEnabled),
            startTime: values.lunchStart,
            endTime: values.lunchEnd,
          },
          emergencyContact: {
            name: values.emergencyName || null,
            phone: values.emergencyPhone || null,
            email: values.emergencyEmail || null,
          },
        },
      });
      toast.success(t('settings.branches.settings.savedToast', 'Settings saved'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('settings.branches.settings.saveErrorToast', 'Save failed'));
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (isError || !branch) return <p className="text-destructive">{t('settings.branches.settings.notFound', 'Branch not found.')}</p>;

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to={branchDetailPath(id)}>← {branch.displayName}</Link>
        </Button>
        <h1 className="font-display text-3xl font-semibold text-primary">{t('settings.branches.settings.title', 'Branch settings')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('settings.branches.settings.description', 'Hours, buffers, lunch break and emergency contact.')}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>{t('settings.branches.settings.operationsCard', 'Operations')}</CardTitle></CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('settings.branches.settings.fields.timeSlotDuration', 'Time slot duration (min)')}</Label>
                <Input type="number" {...register('timeSlotDurationMinutes')} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.branches.settings.fields.appointmentBuffer', 'Appointment buffer (min)')}</Label>
                <Input type="number" {...register('appointmentBufferMinutes')} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.branches.settings.fields.workingDays', 'Working days (0=Sun … 6=Sat, comma-separated)')}</Label>
              <Input {...register('workingDays')} placeholder="1,2,3,4,5,6" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('settings.branches.settings.fields.lunchEnabled', 'Lunch enabled')}</Label>
                <Input type="checkbox" className="h-4 w-4" {...register('lunchEnabled')} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.branches.settings.fields.lunchStart', 'Lunch start')}</Label>
                <Input {...register('lunchStart')} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.branches.settings.fields.lunchEnd', 'Lunch end')}</Label>
                <Input {...register('lunchEnd')} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('settings.branches.settings.fields.emergencyName', 'Emergency name')}</Label>
                <Input {...register('emergencyName')} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.branches.settings.fields.emergencyPhone', 'Emergency phone')}</Label>
                <Input {...register('emergencyPhone')} />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.branches.settings.fields.emergencyEmail', 'Emergency email')}</Label>
                <Input {...register('emergencyEmail')} />
              </div>
            </div>
            <Button type="submit" disabled={updateSettings.isPending}>
              {updateSettings.isPending ? t('settings.branches.settings.saving', 'Saving…') : t('settings.branches.settings.saveAction', 'Save settings')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
