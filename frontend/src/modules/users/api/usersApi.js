import api from '@/services/api';

export const usersApi = {
  list(params = {}) {
    return api.get('/users', { params }).then((res) => res.data);
  },
  getById(id) {
    return api.get(`/users/${id}`).then((res) => res.data);
  },
  create(payload) {
    return api.post('/users', payload).then((res) => res.data);
  },
  update(id, payload, stepUpToken) {
    const config = stepUpToken ? { headers: { 'x-step-up-token': stepUpToken } } : undefined;
    return api.patch(`/users/${id}`, payload, config).then((res) => res.data);
  },
  activate(id) {
    return api.post(`/users/${id}/activate`).then((res) => res.data);
  },
  deactivate(id, reassignToUserId) {
    return api
      .post(`/users/${id}/deactivate`, reassignToUserId ? { reassignToUserId } : {})
      .then((res) => res.data);
  },
  remove(id, reassignToUserId) {
    return api
      .delete(`/users/${id}`, reassignToUserId ? { data: { reassignToUserId } } : undefined)
      .then((res) => res.data);
  },
  resetPassword(id, newPassword) {
    return api.post(`/users/${id}/reset-password`, { newPassword }).then((res) => res.data);
  },
};

export const rolesApi = {
  list() {
    return api.get('/roles').then((res) => res.data);
  },
  permissions() {
    return api.get('/roles/permissions').then((res) => res.data);
  },
  templates() {
    return api.get('/roles/templates').then((res) => res.data);
  },
};

export default usersApi;
