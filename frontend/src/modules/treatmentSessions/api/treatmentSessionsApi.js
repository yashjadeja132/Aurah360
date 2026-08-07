import api from '@/services/api';

export const treatmentSessionsApi = {
  dashboard(params) {
    return api.get('/treatment-sessions/dashboard', { params }).then((res) => res.data);
  },
  list(params) {
    return api.get('/treatment-sessions', { params }).then((res) => res.data);
  },
  progress(planId) {
    return api.get(`/treatment-sessions/progress/${planId}`).then((res) => res.data);
  },
  getById(id) {
    return api.get(`/treatment-sessions/${id}`).then((res) => res.data);
  },
  create(payload) {
    return api.post('/treatment-sessions', payload).then((res) => res.data);
  },
  update(id, payload) {
    return api.patch(`/treatment-sessions/${id}`, payload).then((res) => res.data);
  },
  checkIn(id) {
    return api.post(`/treatment-sessions/${id}/check-in`).then((res) => res.data);
  },
  start(id, payload = {}) {
    return api.post(`/treatment-sessions/${id}/start`, payload).then((res) => res.data);
  },
  complete(id, payload = {}) {
    return api.post(`/treatment-sessions/${id}/complete`, payload).then((res) => res.data);
  },
  cancel(id) {
    return api.post(`/treatment-sessions/${id}/cancel`).then((res) => res.data);
  },
  skip(id) {
    return api.post(`/treatment-sessions/${id}/skip`).then((res) => res.data);
  },
  reschedule(id, scheduledDate) {
    return api.post(`/treatment-sessions/${id}/reschedule`, { scheduledDate }).then((res) => res.data);
  },
  uploadPhoto(id, formData) {
    return api
      .post(`/treatment-sessions/${id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data);
  },
  print(id) {
    return api.get(`/treatment-sessions/${id}/print`).then((res) => res.data);
  },
};

export default treatmentSessionsApi;
