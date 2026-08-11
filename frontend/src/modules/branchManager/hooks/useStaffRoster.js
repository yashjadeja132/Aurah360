import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { staffRosterApi } from '../api/staffRosterApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

export function useStaffRosterToday(params = {}) {
  return useQuery({
    queryKey: ['staff-roster', 'today', params],
    queryFn: async () => {
      const res = await staffRosterApi.today(params);
      return res.data.roster;
    },
    enabled: params.branchId !== undefined ? Boolean(params.branchId) : true,
  });
}

export function useMarkStaffLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }) => staffRosterApi.markLeave(userId, payload),
    onSuccess: () => {
      toast.success('Leave/blocked marked');
      qc.invalidateQueries({ queryKey: ['staff-roster'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not mark leave')),
  });
}

export function useDeleteStaffLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, leaveId }) => staffRosterApi.deleteLeave(userId, leaveId),
    onSuccess: () => {
      toast.success('Leave removed');
      qc.invalidateQueries({ queryKey: ['staff-roster'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not remove leave')),
  });
}

export default useStaffRosterToday;
