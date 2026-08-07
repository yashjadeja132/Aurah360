import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { schedulingApi } from '../api/schedulingApi';
import { QUERY_KEYS } from '@/constants/queryKeys';

export function useAvailableSlots(params, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.SCHEDULING_SLOTS(params),
    queryFn: async () => {
      const res = await schedulingApi.getAvailableSlots(params);
      return res.data;
    },
    enabled: Boolean(params?.doctorId && params?.date && enabled),
  });
}

export function useWeeklyPreview(params, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.SCHEDULING_WEEKLY(params),
    queryFn: async () => {
      const res = await schedulingApi.weeklyPreview(params);
      return res.data;
    },
    enabled: Boolean(params?.doctorId && params?.weekStart && enabled),
  });
}

export function useHolidays(branchId) {
  return useQuery({
    queryKey: QUERY_KEYS.SCHEDULING_HOLIDAYS(branchId),
    queryFn: async () => {
      const res = await schedulingApi.listHolidays(branchId);
      return res.data || [];
    },
    enabled: Boolean(branchId),
  });
}

export function useBlockedSlots(params) {
  return useQuery({
    queryKey: QUERY_KEYS.SCHEDULING_BLOCKED(params),
    queryFn: async () => {
      const res = await schedulingApi.listBlocked(params);
      return res.data || [];
    },
    enabled: Boolean(params?.doctorId),
  });
}

export function useSpecialSchedules(params) {
  return useQuery({
    queryKey: QUERY_KEYS.SCHEDULING_SPECIAL(params),
    queryFn: async () => {
      const res = await schedulingApi.listSpecial(params);
      return res.data || [];
    },
    enabled: Boolean(params?.doctorId),
  });
}

export function useSchedulingMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['scheduling'] });

  return {
    createHoliday: useMutation({
      mutationFn: schedulingApi.createHoliday,
      onSuccess: invalidate,
    }),
    updateHoliday: useMutation({
      mutationFn: ({ id, payload }) => schedulingApi.updateHoliday(id, payload),
      onSuccess: invalidate,
    }),
    deleteHoliday: useMutation({
      mutationFn: schedulingApi.deleteHoliday,
      onSuccess: invalidate,
    }),
    createBlocked: useMutation({
      mutationFn: schedulingApi.createBlocked,
      onSuccess: invalidate,
    }),
    deleteBlocked: useMutation({
      mutationFn: schedulingApi.deleteBlocked,
      onSuccess: invalidate,
    }),
    upsertSpecial: useMutation({
      mutationFn: schedulingApi.upsertSpecial,
      onSuccess: invalidate,
    }),
    deleteSpecial: useMutation({
      mutationFn: schedulingApi.deleteSpecial,
      onSuccess: invalidate,
    }),
    validateSlot: useMutation({ mutationFn: schedulingApi.validateSlot }),
  };
}
