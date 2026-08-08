import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { prescriptionsApi } from '../api/prescriptionsApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

export function usePrescription(id) {
  return useQuery({
    queryKey: QUERY_KEYS.PRESCRIPTION_DETAIL(id),
    queryFn: async () => {
      const res = await prescriptionsApi.getById(id);
      return res.data.prescription;
    },
    enabled: Boolean(id),
  });
}

export function useDoctorPrescriptions(doctorId, params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.PRESCRIPTION_DOCTOR_LIST(doctorId, params),
    queryFn: async () => {
      const res = await prescriptionsApi.listByDoctor({ doctorId, ...params });
      return res.data || [];
    },
    enabled: Boolean(doctorId),
  });
}

/** All prescriptions for one patient — GET /prescriptions/patient/:patientId. */
export function usePatientPrescriptions(patientId) {
  return useQuery({
    queryKey: QUERY_KEYS.PRESCRIPTION_PATIENT_LIST(patientId),
    queryFn: async () => {
      const res = await prescriptionsApi.listByPatient(patientId);
      return res.data || [];
    },
    enabled: Boolean(patientId),
  });
}

export function useConsultationPrescriptions(consultationId) {
  return useQuery({
    queryKey: QUERY_KEYS.PRESCRIPTION_CONSULTATION_LIST(consultationId),
    queryFn: async () => {
      const res = await prescriptionsApi.listByConsultation(consultationId);
      return res.data || [];
    },
    enabled: Boolean(consultationId),
  });
}

export function useMedicineSearch(q) {
  return useQuery({
    queryKey: QUERY_KEYS.MEDICINE_SEARCH(q),
    queryFn: async () => {
      const res = await prescriptionsApi.searchMedicines(q);
      return res.data || [];
    },
    enabled: Boolean(q && q.length >= 1),
  });
}

export function useRecentMedicines(doctorId) {
  return useQuery({
    queryKey: QUERY_KEYS.PRESCRIPTION_RECENT_MEDS(doctorId),
    queryFn: async () => {
      const res = await prescriptionsApi.recentMedicines(doctorId);
      return res.data || [];
    },
    enabled: Boolean(doctorId),
  });
}

export function usePrescriptionTemplates(doctorId) {
  return useQuery({
    queryKey: QUERY_KEYS.PRESCRIPTION_TEMPLATES(doctorId),
    queryFn: async () => {
      const res = await prescriptionsApi.listTemplates(doctorId);
      return res.data || [];
    },
    enabled: Boolean(doctorId),
  });
}

function invalidateAll(qc) {
  qc.invalidateQueries({ queryKey: ['prescriptions'] });
}

export function useCreatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => prescriptionsApi.create(payload),
    onSuccess: () => {
      toast.success('Prescription created');
      invalidateAll(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Create failed')),
  });
}

export function useUpdatePrescription(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => prescriptionsApi.update(id, payload),
    onSuccess: () => {
      toast.success('Draft saved');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.PRESCRIPTION_DETAIL(id) });
    },
    onError: (e) => toast.error(errMsg(e, 'Save failed')),
  });
}

/**
 * RX-SAFETY — server-evaluated allergy/interaction preflight for a prescription.
 * The server enforces the block on finalize regardless; this only lets the editor show it first.
 */
export function usePrescriptionSafety(id, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.PRESCRIPTION_SAFETY(id),
    queryFn: async () => {
      const res = await prescriptionsApi.safetyCheck(id);
      return res.data.safety;
    },
    enabled: Boolean(id) && enabled,
  });
}

export function useFinalizePrescription(id) {
  const qc = useQueryClient();
  return useMutation({
    // payload may carry { override: { reason } } for a blocking safety alert.
    mutationFn: (payload = {}) => prescriptionsApi.finalize(id, payload),
    onSuccess: () => {
      toast.success('Prescription finalized');
      invalidateAll(qc);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.PRESCRIPTION_DETAIL(id) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.PRESCRIPTION_SAFETY(id) });
    },
    onError: (e) =>
      toast.error(
        e?.response?.data?.code === 'PRESCRIPTION_SAFETY_BLOCKED'
          ? errMsg(e, 'Blocked by a prescribing safety alert')
          : errMsg(e, 'Finalize failed')
      ),
  });
}

export function useDuplicatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => prescriptionsApi.duplicate(id),
    onSuccess: () => {
      toast.success('Duplicated as new draft');
      invalidateAll(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Duplicate failed')),
  });
}

export function useDeletePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => prescriptionsApi.remove(id),
    onSuccess: () => {
      toast.success('Draft deleted');
      invalidateAll(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Delete failed')),
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => prescriptionsApi.createTemplate(payload),
    onSuccess: () => {
      toast.success('Saved to favorites');
      invalidateAll(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Template save failed')),
  });
}

export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, consultationId }) =>
      prescriptionsApi.applyTemplate(templateId, consultationId),
    onSuccess: () => {
      toast.success('Template applied');
      invalidateAll(qc);
    },
    onError: (e) => toast.error(errMsg(e, 'Apply failed')),
  });
}
