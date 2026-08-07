import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { patientsApi } from '../api/patientsApi';
import { QUERY_KEYS } from '@/constants/queryKeys';

export function usePatientList(params) {
  return useQuery({
    queryKey: QUERY_KEYS.PATIENT_LIST(params),
    queryFn: async () => {
      const res = await patientsApi.list(params);
      return { items: res.data || [], meta: res.meta };
    },
    keepPreviousData: true,
  });
}

export function usePatientDetail(id) {
  return useQuery({
    queryKey: QUERY_KEYS.PATIENT_DETAIL(id),
    queryFn: async () => {
      const res = await patientsApi.getById(id);
      return res.data.patient;
    },
    enabled: Boolean(id),
  });
}

export function usePatientDocuments(id) {
  return useQuery({
    queryKey: QUERY_KEYS.PATIENT_DOCUMENTS(id),
    queryFn: async () => {
      const res = await patientsApi.listDocuments(id);
      return res.data || [];
    },
    enabled: Boolean(id),
  });
}

export function usePatientTimeline(id) {
  return useQuery({
    queryKey: QUERY_KEYS.PATIENT_TIMELINE(id),
    queryFn: async () => {
      const res = await patientsApi.timeline(id);
      return res.data || [];
    },
    enabled: Boolean(id),
  });
}

export function usePatientMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['patients'] });

  return {
    create: useMutation({ mutationFn: patientsApi.create, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, payload }) => patientsApi.update(id, payload),
      onSuccess: invalidate,
    }),
    updateConsent: useMutation({
      mutationFn: ({ id, payload }) => patientsApi.updateConsent(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: patientsApi.remove, onSuccess: invalidate }),
    checkDuplicates: useMutation({ mutationFn: patientsApi.checkDuplicates }),
    uploadDocument: useMutation({
      mutationFn: ({ id, formData }) => patientsApi.uploadDocument(id, formData),
      onSuccess: invalidate,
    }),
    renameDocument: useMutation({
      mutationFn: ({ id, documentId, title }) =>
        patientsApi.renameDocument(id, documentId, title),
      onSuccess: invalidate,
    }),
    deleteDocument: useMutation({
      mutationFn: ({ id, documentId }) => patientsApi.deleteDocument(id, documentId),
      onSuccess: invalidate,
    }),
  };
}
