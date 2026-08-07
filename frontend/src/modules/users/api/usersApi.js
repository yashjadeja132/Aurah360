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
  update(id, payload) {
    return api.patch(`/users/${id}`, payload).then((res) => res.data);
  },
  activate(id) {
    return api.post(`/users/${id}/activate`).then((res) => res.data);
  },
  deactivate(id) {
    return api.post(`/users/${id}/deactivate`).then((res) => res.data);
  },
  remove(id) {
    return api.delete(`/users/${id}`).then((res) => res.data);
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
};

export default usersApi;
