import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doctorsApi } from '../api/doctorsApi';
import { QUERY_KEYS } from '@/constants/queryKeys';

export function useDoctorList(params) {
  return useQuery({
    queryKey: QUERY_KEYS.DOCTOR_LIST(params),
    queryFn: async () => {
      const res = await doctorsApi.list(params);
      return { items: res.data || [], meta: res.meta };
    },
    keepPreviousData: true,
  });
}

export function useDoctorDetail(id) {
  return useQuery({
    queryKey: QUERY_KEYS.DOCTOR_DETAIL(id),
    queryFn: async () => {
      const res = await doctorsApi.getById(id);
      return res.data.doctor;
    },
    enabled: Boolean(id),
  });
}

export function useDoctorSchedules(id, branchId) {
  return useQuery({
    queryKey: QUERY_KEYS.DOCTOR_SCHEDULES(id, branchId),
    queryFn: async () => {
      const res = await doctorsApi.listSchedules(id, branchId ? { branchId } : {});
      return res.data || [];
    },
    enabled: Boolean(id),
  });
}

export function useDoctorLeaves(id) {
  return useQuery({
    queryKey: QUERY_KEYS.DOCTOR_LEAVES(id),
    queryFn: async () => {
      const res = await doctorsApi.listLeaves(id);
      return res.data || [];
    },
    enabled: Boolean(id),
  });
}

export function useDoctorMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['doctors'] });

  return {
    create: useMutation({ mutationFn: doctorsApi.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, payload }) => doctorsApi.update(id, payload),
      onSuccess: invalidate,
    }),
    activate: useMutation({ mutationFn: doctorsApi.activate, onSuccess: invalidate }),
    deactivate: useMutation({ mutationFn: doctorsApi.deactivate, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: doctorsApi.remove, onSuccess: invalidate }),
    upsertSchedules: useMutation({
      mutationFn: ({ id, payload }) => doctorsApi.upsertSchedules(id, payload),
      onSuccess: invalidate,
    }),
    createLeave: useMutation({
      mutationFn: ({ id, payload }) => doctorsApi.createLeave(id, payload),
      onSuccess: invalidate,
    }),
    deleteLeave: useMutation({
      mutationFn: ({ id, leaveId }) => doctorsApi.deleteLeave(id, leaveId),
      onSuccess: invalidate,
    }),
  };
}
