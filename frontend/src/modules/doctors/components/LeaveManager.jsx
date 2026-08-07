import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';
import { leaveFormSchema } from '../validation/doctorSchema';
import { useDoctorLeaves, useDoctorMutations } from '../hooks/useDoctors';

export function LeaveManager({ doctorId, branches = [] }) {
  const { t } = useTranslation();
  const { data: leaves = [], isLoading } = useDoctorLeaves(doctorId);
  const { createLeave, deleteLeave } = useDoctorMutations();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: {
      leaveType: 'FULL_DAY',
      startDate: '',
      endDate: '',
      reason: '',
      branchId: '',
    },
  });

  const onSubmit = async (values) => {
    try {
      await createLeave.mutateAsync({
        id: doctorId,
        payload: {
          ...values,
          branchId: values.branchId || null,
          reason: values.reason || null,
        },
      });
      toast.success(t('doctors.leaveManager.toastAdded', 'Leave added'));
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || t('doctors.leaveManager.failed', 'Failed'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen((v) => !v)}>
          {open ? t('common.cancel', 'Cancel') : t('doctors.leaveManager.addLeave', 'Add leave')}
        </Button>
      </div>

      {open && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-xl border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('doctors.leaveManager.type', 'Type')}</Label>
              <Select {...register('leaveType')}>
                <option value="FULL_DAY">{t('doctors.leaveManager.fullDay', 'Full day')}</option>
                <option value="HALF_DAY">{t('doctors.leaveManager.halfDay', 'Half day')}</option>
                <option value="CUSTOM">{t('doctors.leaveManager.custom', 'Custom')}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('doctors.leaveManager.branchOptional', 'Branch (optional)')}</Label>
              <Select {...register('branchId')}>
                <option value="">{t('doctors.leaveManager.allBranches', 'All branches')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.displayName || b.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('doctors.leaveManager.start', 'Start')}</Label>
              <Input type="date" {...register('startDate')} />
              {errors.startDate && <p className="text-sm text-destructive">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>{t('doctors.leaveManager.end', 'End')}</Label>
              <Input type="date" {...register('endDate')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('doctors.leaveManager.reason', 'Reason')}</Label>
            <Input {...register('reason')} />
          </div>
          <Button type="submit" disabled={createLeave.isPending}>{t('doctors.leaveManager.saveLeave', 'Save leave')}</Button>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
      ) : !leaves.length ? (
        <EmptyState
          title={t('doctors.leaveManager.emptyTitle', 'No leave records')}
          description={t('doctors.leaveManager.emptyDescription', 'Add leave to block availability.')}
        />
      ) : (
        <div className="space-y-2">
          {leaves.map((leave) => (
            <div key={leave.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
              <div>
                <p className="text-sm font-medium">
                  {new Date(leave.startDate).toLocaleDateString()} → {new Date(leave.endDate).toLocaleDateString()}
                </p>
                <p className="text-xs text-muted-foreground">{leave.reason || leave.leaveType}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{leave.status}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    deleteLeave.mutateAsync({ id: doctorId, leaveId: leave.id })
                      .then(() => toast.success(t('doctors.leaveManager.toastRemoved', 'Leave removed')))
                      .catch((e) => toast.error(e.response?.data?.message || t('doctors.leaveManager.failed', 'Failed')))
                  }
                >
                  {t('common.delete', 'Delete')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LeaveManager;
