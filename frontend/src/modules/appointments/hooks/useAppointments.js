import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { appointmentsApi } from '../api/appointmentsApi';
import { QUERY_KEYS } from '@/constants/queryKeys';

export function useAppointmentList(params) {
  return useQuery({
    queryKey: QUERY_KEYS.APPOINTMENT_LIST(params),
    queryFn: async () => {
      const res = await appointmentsApi.list(params);
      return { items: res.data || [], meta: res.meta };
    },
    keepPreviousData: true,
  });
}

export function useAppointmentDetail(id) {
  return useQuery({
    queryKey: QUERY_KEYS.APPOINTMENT_DETAIL(id),
    queryFn: async () => {
      const res = await appointmentsApi.getById(id);
      return res.data.appointment;
    },
    enabled: Boolean(id),
  });
}

export function useAvailableAppointmentSlots(params, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.APPOINTMENT_SLOTS(params),
    queryFn: async () => {
      const res = await appointmentsApi.availableSlots(params);
      return res.data;
    },
    enabled: Boolean(params?.doctorId && params?.date && params?.branchId && enabled),
  });
}

export function useDoctorCalendar(params, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.APPOINTMENT_DOCTOR_CALENDAR(params),
    queryFn: async () => {
      const res = await appointmentsApi.doctorCalendar(params);
      return res.data || [];
    },
    enabled: Boolean(params?.doctorId && params?.from && params?.to && enabled),
  });
}

export function usePatientAppointmentHistory(patientId) {
  return useQuery({
    queryKey: QUERY_KEYS.APPOINTMENT_PATIENT_HISTORY(patientId),
    queryFn: async () => {
      const res = await appointmentsApi.patientHistory(patientId);
      return res.data || [];
    },
    enabled: Boolean(patientId),
  });
}

export function useAppointmentMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['appointments'] });

  return {
    create: useMutation({ mutationFn: appointmentsApi.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, payload }) => appointmentsApi.update(id, payload),
      onSuccess: invalidate,
    }),
    confirm: useMutation({ mutationFn: appointmentsApi.confirm, onSuccess: invalidate }),
    cancel: useMutation({
      mutationFn: ({ id, reason }) => appointmentsApi.cancel(id, { reason }),
      onSuccess: invalidate,
    }),
    noShow: useMutation({ mutationFn: appointmentsApi.noShow, onSuccess: invalidate }),
    complete: useMutation({ mutationFn: appointmentsApi.complete, onSuccess: invalidate }),
    reschedule: useMutation({
      mutationFn: ({ id, payload }) => appointmentsApi.reschedule(id, payload),
      onSuccess: invalidate,
    }),
    followUp: useMutation({
      mutationFn: ({ id, payload }) => appointmentsApi.followUp(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: appointmentsApi.remove, onSuccess: invalidate }),
  };
}
