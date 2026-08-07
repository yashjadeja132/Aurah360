import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { treatmentSafetyApi } from '../api/treatmentSafetyApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

export function usePatientPatchTests(patientId) {
  return useQuery({
    queryKey: ['treatment-safety', 'patch-tests', patientId],
    queryFn: async () => (await treatmentSafetyApi.listPatchTestsForPatient(patientId)).data.tests || [],
    enabled: Boolean(patientId),
  });
}

export function useRecordPatchTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => treatmentSafetyApi.recordPatchTest(payload),
    onSuccess: (_, payload) => {
      toast.success('Patch test recorded');
      qc.invalidateQueries({ queryKey: ['treatment-safety', 'patch-tests', payload.patientId] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not record patch test')),
  });
}

export function useReviewPatchTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => treatmentSafetyApi.reviewPatchTest(id, payload),
    onSuccess: () => {
      toast.success('Patch test reviewed');
      qc.invalidateQueries({ queryKey: ['treatment-safety', 'patch-tests'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not review patch test')),
  });
}

export function useAdverseEvents(params = {}) {
  return useQuery({
    queryKey: ['treatment-safety', 'adverse-events', params],
    queryFn: async () => (await treatmentSafetyApi.listAdverseEvents(params)).data.events || [],
  });
}

export function useReportAdverseEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => treatmentSafetyApi.reportAdverseEvent(payload),
    onSuccess: () => {
      toast.success('Adverse event reported and escalated');
      qc.invalidateQueries({ queryKey: ['treatment-safety', 'adverse-events'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not report adverse event')),
  });
}

export function useCloseAdverseEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => treatmentSafetyApi.closeAdverseEvent(id, payload),
    onSuccess: () => {
      toast.success('Adverse event closed');
      qc.invalidateQueries({ queryKey: ['treatment-safety', 'adverse-events'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Could not close event')),
  });
}
