import api from '@/services/api';

export const branchesApi = {
  list(params = {}) {
    return api.get('/branches', { params }).then((res) => res.data);
  },
  getById(id) {
    return api.get(`/branches/${id}`).then((res) => res.data);
  },
  create(payload) {
    return api.post('/branches', payload).then((res) => res.data);
  },
  update(id, payload) {
    return api.patch(`/branches/${id}`, payload).then((res) => res.data);
  },
  updateSettings(id, payload) {
    return api.patch(`/branches/${id}/settings`, payload).then((res) => res.data);
  },
  activate(id) {
    return api.post(`/branches/${id}/activate`).then((res) => res.data);
  },
  deactivate(id) {
    return api.post(`/branches/${id}/deactivate`).then((res) => res.data);
  },
  remove(id) {
    return api.delete(`/branches/${id}`).then((res) => res.data);
  },
};

export default branchesApi;
