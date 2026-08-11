import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi, rolesApi } from '../api/usersApi';
import { QUERY_KEYS } from '@/constants/queryKeys';

export function useStaffList(params) {
  return useQuery({
    queryKey: QUERY_KEYS.STAFF_LIST(params),
    queryFn: async () => {
      const res = await usersApi.list(params);
      return { items: res.data || [], meta: res.meta };
    },
    keepPreviousData: true,
  });
}

export function useStaffDetail(id) {
  return useQuery({
    queryKey: QUERY_KEYS.STAFF_DETAIL(id),
    queryFn: async () => {
      const res = await usersApi.getById(id);
      return res.data.user;
    },
    enabled: Boolean(id),
  });
}

export function useRolesQuery() {
  return useQuery({
    queryKey: QUERY_KEYS.ROLES,
    queryFn: async () => {
      const res = await rolesApi.list();
      return res.data.roles || [];
    },
  });
}

/** §2.1 — the full permission catalogue, grouped by module, for the staff permission toggles. */
export function usePermissionsCatalogue() {
  return useQuery({
    queryKey: ['roles', 'permissions'],
    queryFn: async () => {
      const res = await rolesApi.permissions();
      return res.data.permissions || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** §2.1 — per-role default permission bundle, sourced from the backend's rolePermissions.js. */
export function useRoleTemplates() {
  return useQuery({
    queryKey: ['roles', 'templates'],
    queryFn: async () => {
      const res = await rolesApi.templates();
      return res.data.templates || {};
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
  });
}

export function useUpdateStaff(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, stepUpToken }) => usersApi.update(id, payload, stepUpToken),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.STAFF_DETAIL(id) });
    },
  });
}

export function useStaffActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['staff'] });

  return {
    activate: useMutation({ mutationFn: usersApi.activate, onSuccess: invalidate }),
    deactivate: useMutation({ mutationFn: usersApi.deactivate, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: usersApi.remove, onSuccess: invalidate }),
    resetPassword: useMutation({
      mutationFn: ({ id, newPassword }) => usersApi.resetPassword(id, newPassword),
      onSuccess: invalidate,
    }),
  };
}
