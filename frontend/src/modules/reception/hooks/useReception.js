import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { receptionApi } from '../api/receptionApi';
import { queueApi } from '../api/queueApi';

function errMsg(error, fallback) {
  return error?.response?.data?.message || fallback;
}

export function useReceptionDashboard(branchId, date) {
  return useQuery({
    queryKey: QUERY_KEYS.RECEPTION_DASHBOARD(branchId, date),
    queryFn: () => receptionApi.dashboard({ branchId, date }),
    enabled: Boolean(branchId),
    refetchInterval: 30000,
  });
}

export function useTodaysAppointments(params) {
  return useQuery({
    queryKey: QUERY_KEYS.RECEPTION_TODAY(params?.branchId, params?.date, params),
    queryFn: () => receptionApi.todaysAppointments(params),
    enabled: Boolean(params?.branchId),
  });
}

export function useBranchQueue(branchId, date) {
  return useQuery({
    queryKey: QUERY_KEYS.QUEUE_BRANCH(branchId, date),
    queryFn: () => queueApi.branchQueue({ branchId, date }),
    enabled: Boolean(branchId),
  });
}

/** Lobby/TV display board — masked payload, see queueApi#publicBranchQueue. Polls as a
 * fallback in addition to the socket-driven invalidation from useQueueSocket. */
export function usePublicBranchQueue(branchId, date) {
  return useQuery({
    queryKey: [...QUERY_KEYS.QUEUE_BRANCH(branchId, date), 'public'],
    queryFn: () => queueApi.publicBranchQueue({ branchId, date }),
    enabled: Boolean(branchId),
    refetchInterval: 15000,
  });
}

export function useDoctorQueue(doctorId, date) {
  return useQuery({
    queryKey: QUERY_KEYS.QUEUE_DOCTOR(doctorId, date),
    queryFn: () => queueApi.doctorQueue({ doctorId, date }),
    enabled: Boolean(doctorId),
  });
}

export function useQueueSummary(branchId, date) {
  return useQuery({
    queryKey: QUERY_KEYS.QUEUE_SUMMARY(branchId, date),
    queryFn: () => queueApi.summary({ branchId, date }),
    enabled: Boolean(branchId),
  });
}

function useInvalidateReception() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['reception'] });
    qc.invalidateQueries({ queryKey: ['queue'] });
  };
}

export function useCheckIn() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: ({ appointmentId, payload }) => receptionApi.checkIn(appointmentId, payload),
    onSuccess: (res) => {
      toast.success(`Checked in — ${res?.data?.queueEntry?.tokenNumber || 'token assigned'}`);
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Check-in failed')),
  });
}

export function useUndoCheckIn() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (appointmentId) => receptionApi.undoCheckIn(appointmentId),
    onSuccess: () => {
      toast.success('Check-in undone');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Undo failed')),
  });
}

export function useWalkIn() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (payload) => receptionApi.walkIn(payload),
    onSuccess: (res) => {
      toast.success(`Walk-in — ${res?.data?.queueEntry?.tokenNumber || 'queued'}`);
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Walk-in failed')),
  });
}

export function useCallNext() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (doctorId) => queueApi.callNext(doctorId),
    onSuccess: () => {
      toast.success('Next patient called');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Call next failed')),
  });
}

export function useCallPatient() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (id) => queueApi.call(id),
    onSuccess: () => {
      toast.success('Patient called');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Call failed')),
  });
}

export function useRecallPatient() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (id) => queueApi.recall(id),
    onSuccess: () => {
      toast.success('Patient recalled');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Recall failed')),
  });
}

export function useSkipPatient() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (id) => queueApi.skip(id),
    onSuccess: () => {
      toast.success('Patient skipped');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Skip failed')),
  });
}

export function useStartConsultation() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (id) => queueApi.startConsultation(id),
    onSuccess: () => {
      toast.success('Consultation started');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Start failed')),
  });
}

export function useCompleteQueue() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: (id) => queueApi.complete(id),
    onSuccess: () => {
      toast.success('Queue completed');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Complete failed')),
  });
}

export function useTransferQueue() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: ({ id, payload }) => queueApi.transfer(id, payload),
    onSuccess: () => {
      toast.success('Transferred');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Transfer failed')),
  });
}

export function useReorderQueue() {
  const invalidate = useInvalidateReception();
  return useMutation({
    mutationFn: ({ id, payload }) => queueApi.reorder(id, payload),
    onSuccess: () => {
      toast.success('Queue reordered');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Reorder failed')),
  });
}
