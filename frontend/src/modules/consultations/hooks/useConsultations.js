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

/**
 * Lightweight consultation fetch — just the consultation document (already carries nested
 * patient/doctor/branch/appointment). Use this instead of useConsultationWorkspace() for
 * anything that only needs to DISPLAY a human-readable reference (consultation number, patient
 * name) — the workspace endpoint additionally loads SOAP, vitals, diagnosis, examination and
 * photos, which is a meaningfully heavier/slower call for a label that needs none of it.
 */
export function useConsultationDetail(id) {
  return useQuery({
    queryKey: QUERY_KEYS.CONSULTATION_DETAIL(id),
    queryFn: async () => {
      const res = await consultationsApi.getById(id);
      return res.data.consultation;
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

/** All consultations for one patient — GET /consultations/patient/:patientId. */
export function usePatientConsultations(patientId) {
  return useQuery({
    queryKey: QUERY_KEYS.CONSULTATION_PATIENT_LIST(patientId),
    queryFn: async () => {
      const res = await consultationsApi.listByPatient(patientId);
      return res.data || [];
    },
    enabled: Boolean(patientId),
  });
}

/**
 * Clinical photos for one consultation — GET /consultations/:id/photos. Same endpoint (and
 * therefore the same consultation.view permission + consent metadata) the consultation
 * workspace photos panel reads; no new ungated image path is introduced.
 */
export function useConsultationPhotos(consultationId, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.CONSULTATION_PHOTOS(consultationId),
    queryFn: async () => {
      const res = await consultationsApi.listPhotos(consultationId);
      return res.data || [];
    },
    enabled: Boolean(consultationId) && enabled,
  });
}

export function useDoctorConsultations(doctorId, params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.CONSULTATION_DOCTOR_LIST(doctorId, params),
    queryFn: async () => {
      const res = await consultationsApi.listByDoctor({ doctorId, ...params });
      return res.data || [];
    },
    // doctorId === undefined means "omit it — let the backend pin it to the caller's own
    // doctor profile" (DOCTOR role, see scope.helper.js#resolveDoctorScope); only an explicit
    // empty string (no doctor picked yet in a non-doctor staff view) disables the query.
    enabled: doctorId !== '',
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

export function useConsultationLabOrders(id) {
  return useQuery({
    queryKey: QUERY_KEYS.CONSULTATION_LAB_ORDERS(id),
    queryFn: async () => {
      const res = await consultationsApi.listLabOrders(id);
      return res.data?.orders || [];
    },
    enabled: Boolean(id),
  });
}

/**
 * A13 — cross-patient Report Review worklist. Rows already carry populated patient/consultation
 * context, so no per-row follow-up fetch is needed.
 */
export function useLabOrderReviewQueue(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.LAB_ORDER_REVIEW_QUEUE(params),
    queryFn: async () => {
      const res = await consultationsApi.labOrderReviewQueue(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

/**
 * §5 — cross-patient Follow-ups due/overdue worklist. Rows already carry populated
 * patient/doctor/preferred-doctor/branch context, so no per-row follow-up fetch is needed.
 */
export function useFollowUpQueue(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.FOLLOW_UP_QUEUE(params),
    queryFn: async () => {
      const res = await consultationsApi.followUpQueue(params);
      return { items: res.data || [], meta: res.meta };
    },
  });
}

export function useUpdateFollowUpStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }) => consultationsApi.updateFollowUpStatus(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['consultations', 'follow-ups'] });
    },
    onError: (e) => toast.error(errMsg(e, 'Failed to update follow-up')),
  });
}

function useInvalidateWorkspace(id) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.CONSULTATION_WORKSPACE(id) });
    qc.invalidateQueries({ queryKey: ['consultations'] });
    // Signing completes the underlying appointment, so any cached appointment list is now wrong.
    // Without this the doctor navigates back to "Start from appointment" inside the 30s staleTime
    // and still sees the patient they just signed off — the queries default to
    // refetchOnWindowFocus: false, so nothing else would correct it.
    qc.invalidateQueries({ queryKey: ['appointments'] });
    qc.invalidateQueries({ queryKey: ['queue'] });
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

/** §3.7 — classify-then-release; invalidates the workspace so patientFacingSummary/releaseSections refresh. */
export function useReleaseSummary(id) {
  const invalidate = useInvalidateWorkspace(id);
  return useMutation({
    mutationFn: (payload) => consultationsApi.releaseSummary(id, payload),
    onSuccess: () => {
      toast.success('Summary released to patient');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Release failed')),
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
 * IMG-005 — release / un-release a clinical photo to the patient portal. Invalidates the same
 * workspace query as capture so the badge on the card reflects the new visibility immediately.
 */
export function useReleasePhoto(id) {
  const invalidate = useInvalidateWorkspace(id);
  return useMutation({
    mutationFn: ({ photoId, visibility }) => consultationsApi.releasePhoto(photoId, visibility),
    onSuccess: (_data, { visibility }) => {
      toast.success(visibility === 'HIDDEN' ? 'Photo hidden from patient' : 'Photo released to patient');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Photo release failed')),
  });
}

function useInvalidateLabOrders(id) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: QUERY_KEYS.CONSULTATION_LAB_ORDERS(id) });
    qc.invalidateQueries({ queryKey: QUERY_KEYS.CONSULTATION_WORKSPACE(id) });
  };
}

export function useCreateLabOrder(id) {
  const invalidate = useInvalidateLabOrders(id);
  return useMutation({
    mutationFn: (payload) => consultationsApi.createLabOrder(id, payload),
    onSuccess: () => {
      toast.success('Lab order created');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Lab order failed')),
  });
}

export function useUpdateLabOrder(id) {
  const invalidate = useInvalidateLabOrders(id);
  return useMutation({
    mutationFn: ({ labOrderId, ...payload }) =>
      consultationsApi.updateLabOrder(id, labOrderId, payload),
    onSuccess: () => {
      toast.success('Lab order updated');
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, 'Lab order update failed')),
  });
}

/**
 * A13 — inline "Mark reviewed" from the cross-patient Report Review queue. Unlike
 * useUpdateLabOrder(id), rows in the queue each belong to a different consultation, so this
 * mutation takes the consultationId per-call instead of binding it up front, and invalidates the
 * review queue list (plus that row's consultation caches) on success.
 */
export function useUpdateLabOrderFromQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ consultationId, labOrderId, ...payload }) =>
      consultationsApi.updateLabOrder(consultationId, labOrderId, payload),
    onSuccess: (_data, variables) => {
      toast.success('Lab order updated');
      qc.invalidateQueries({ queryKey: ['consultations', 'lab-orders', 'review-queue'] });
      if (variables?.consultationId) {
        qc.invalidateQueries({ queryKey: QUERY_KEYS.CONSULTATION_LAB_ORDERS(variables.consultationId) });
        qc.invalidateQueries({ queryKey: QUERY_KEYS.CONSULTATION_WORKSPACE(variables.consultationId) });
      }
    },
    onError: (e) => toast.error(errMsg(e, 'Lab order update failed')),
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
