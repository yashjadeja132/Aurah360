import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { consultationsApi } from '../api/consultationsApi';

const KEY = ['consultations', 'templates', 'admin'];

/** Settings → Masters admin listing — unscoped, paginated/searchable (CONSULTATION_TEMPLATE_MANAGE). */
export function useConsultationTemplatesAdmin(params) {
  return useQuery({
    queryKey: [...KEY, params],
    queryFn: async () => {
      const res = await consultationsApi.listAllTemplates(params);
      return { items: res.data || [], meta: res.meta };
    },
    keepPreviousData: true,
  });
}

export function useConsultationTemplateAdminMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY });

  return {
    create: useMutation({
      mutationFn: (payload) => consultationsApi.createTemplate(payload),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, payload }) => consultationsApi.updateTemplate(id, payload),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id) => consultationsApi.deleteTemplate(id),
      onSuccess: invalidate,
    }),
    approve: useMutation({
      mutationFn: (id) => consultationsApi.approveTemplate(id),
      onSuccess: invalidate,
    }),
  };
}

export default useConsultationTemplatesAdmin;
