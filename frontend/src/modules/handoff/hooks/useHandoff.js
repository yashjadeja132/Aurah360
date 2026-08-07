import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { handoffApi } from '../api/handoffApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

export function useHandoffNotesForPatient(patientId) {
  return useQuery({
    queryKey: ['handoff', 'patient', patientId],
    queryFn: async () => (await handoffApi.listForPatient(patientId)).data.notes || [],
    enabled: Boolean(patientId),
  });
}

export function useUnacknowledgedHandoffNotesForDoctor(doctorId) {
  return useQuery({
    queryKey: ['handoff', 'doctor-unacknowledged', doctorId],
    queryFn: async () => (await handoffApi.listUnacknowledgedForDoctor(doctorId)).data.notes || [],
    enabled: Boolean(doctorId),
  });
}

export function useCreateHandoffNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => handoffApi.create(payload),
    onSuccess: (_res, payload) => {
      toast.success('Handoff note created');
      qc.invalidateQueries({ queryKey: ['handoff', 'patient', payload.patientId] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not create handoff note')),
  });
}

export function useAcknowledgeHandoffNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => handoffApi.acknowledge(id, payload),
    onSuccess: () => {
      toast.success('Handoff note acknowledged');
      qc.invalidateQueries({ queryKey: ['handoff'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not acknowledge handoff note')),
  });
}

export function useAmendHandoffNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => handoffApi.amend(id, payload),
    onSuccess: () => {
      toast.success('Handoff note amended');
      qc.invalidateQueries({ queryKey: ['handoff'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not amend handoff note')),
  });
}
