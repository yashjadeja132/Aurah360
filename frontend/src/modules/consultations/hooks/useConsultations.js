import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QUERY_KEYS } from '@/constants/queryKeys';
import { consultationsApi } from '../api/consultationsApi';

function errMsg(e, fallback) {
  return e?.response?.data?.message || fallback;
}

export function useConsultationWorkspace(id) {
  return useQuery({
    queryKey: QUERY_KEYS.CONSULTATION_WORKSPACE(id),
    queryFn: async () => {
      const res = await consultationsApi.getWorkspace(id);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

export function usePatientConsultationSummary(patientId) {
  return useQuery({
    queryKey: QUERY_KEYS.CONSULTATION_PATIENT_SUMMARY(patientId),
    queryFn: async () => {
      const res = await consultationsApi.patientSummary(patientId);
      return res.data;
    },
    enabled: Boolean(patientId),
  });
}

export function useDoctorConsultations(doctorId, params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.CONSULTATION_DOCTOR_LIST(doctorId, params),
    queryFn: async () => {
      const res = await consultationsApi.listByDoctor({ doctorId, ...params });
      return res.data || [];
    },
    enabled: Boolean(doctorId),
  });
}

export function useSoapVersions(id) {
  return useQuery({
    queryKey: QUERY_KEYS.CONSULTATION_SOAP_VERSIONS(id),
    queryFn: async () => {
      const res = await consultationsApi.soapVersions(id);
      return res.data;
    },
    enabled: Boolean(id),
  });
}

function useInvalidateWorkspace(id) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.CONSULTATION_WORKSPACE(id) });
    qc.invalidateQueries({ queryKey: ['consultations'] });
  };
}

export function useStartConsultation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => consultationsApi.start(payload),
    onSuccess: () => {
      toast.success('Consultation started');
      qc.invalidateQueries({ queryKey: ['consultations'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to start consultation')),
  });
}

export function useSignConsultation(id) {
  const invalidate = useInvalidateWorkspace(id);
  return useMutation({
    mutationFn: () => consultationsApi.sign(id),
    onSuccess: () => {
      toast.success('Consultation signed');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Sign failed')),
  });
}

export function useLockConsultation(id) {
  const invalidate = useInvalidateWorkspace(id);
  return useMutation({
    mutationFn: () => consultationsApi.lock(id),
    onSuccess: () => {
      toast.success('Consultation locked');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Lock failed')),
  });
}

export function useUpdateConsultation(id) {
  const invalidate = useInvalidateWorkspace(id);
  return useMutation({
    mutationFn: (payload) => consultationsApi.update(id, payload),
    onSuccess: () => {
      toast.success('Saved');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Save failed')),
  });
}

export function useSaveVitals(id) {
  const invalidate = useInvalidateWorkspace(id);
  return useMutation({
    mutationFn: (payload) => consultationsApi.saveVitals(id, payload),
    onSuccess: () => {
      toast.success('Vitals saved');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Vitals save failed')),
  });
}

export function useSaveDiagnosis(id) {
  const invalidate = useInvalidateWorkspace(id);
  return useMutation({
    mutationFn: (payload) => consultationsApi.saveDiagnosis(id, payload),
    onSuccess: () => {
      toast.success('Diagnosis saved');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Diagnosis save failed')),
  });
}

export function useSaveExamination(id) {
  const invalidate = useInvalidateWorkspace(id);
  return useMutation({
    mutationFn: (payload) => consultationsApi.saveExamination(id, payload),
    onSuccess: () => {
      toast.success('Examination saved');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Examination save failed')),
  });
}

export function useUploadPhoto(id) {
  const invalidate = useInvalidateWorkspace(id);
  return useMutation({
    mutationFn: (formData) => consultationsApi.uploadPhoto(id, formData),
    onSuccess: () => {
      toast.success('Photo uploaded');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Upload failed')),
  });
}

/**
 * Debounced SOAP autosave — silent except draft indicator via onStatus.
 */
export function useSoapAutosave(consultationId, { enabled = true, delayMs = 1200 } = {}) {
  const timer = useRef(null);
  const qc = useQueryClient();

  useEffect(() => () => clearTimeout(timer.current), []);

  const save = (payload, onStatus) => {
    if (!enabled || !consultationId) return;
    clearTimeout(timer.current);
    onStatus?.('saving');
    timer.current = setTimeout(async () => {
      try {
        await consultationsApi.autosaveSoap(consultationId, payload);
        onStatus?.('saved');
        qc.invalidateQueries({ queryKey: QUERY_KEYS.CONSULTATION_SOAP_VERSIONS(consultationId) });
      } catch {
        onStatus?.('error');
      }
    }, delayMs);
  };

  return { save };
}
