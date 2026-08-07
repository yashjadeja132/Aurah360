import api from '@/services/api';

export const mastersApi = {
  list(slug, params = {}) {
    return api.get(`/masters/${slug}`, { params }).then((res) => res.data);
  },
  listActive(slug) {
    return api.get(`/masters/${slug}/active`).then((res) => res.data);
  },
  getById(slug, id) {
    return api.get(`/masters/${slug}/${id}`).then((res) => res.data);
  },
  create(slug, payload) {
    return api.post(`/masters/${slug}`, payload).then((res) => res.data);
  },
  update(slug, id, payload) {
    return api.patch(`/masters/${slug}/${id}`, payload).then((res) => res.data);
  },
  activate(slug, id) {
    return api.post(`/masters/${slug}/${id}/activate`).then((res) => res.data);
  },
  deactivate(slug, id) {
    return api.post(`/masters/${slug}/${id}/deactivate`).then((res) => res.data);
  },
  remove(slug, id) {
    return api.delete(`/masters/${slug}/${id}`).then((res) => res.data);
  },
};

export default mastersApi;
