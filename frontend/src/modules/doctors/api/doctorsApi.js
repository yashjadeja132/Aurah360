import api from '@/services/api';

export const doctorsApi = {
  list(params = {}) {
    return api.get('/doctors', { params }).then((res) => res.data);
  },
  getById(id) {
    return api.get(`/doctors/${id}`).then((res) => res.data);
  },
  create(payload) {
    return api.post('/doctors', payload).then((res) => res.data);
  },
  update(id, payload) {
    return api.patch(`/doctors/${id}`, payload).then((res) => res.data);
  },
  activate(id) {
    return api.post(`/doctors/${id}/activate`).then((res) => res.data);
  },
  deactivate(id) {
    return api.post(`/doctors/${id}/deactivate`).then((res) => res.data);
  },
  remove(id) {
    return api.delete(`/doctors/${id}`).then((res) => res.data);
  },
  listSchedules(id, params = {}) {
    return api.get(`/doctors/${id}/schedules`, { params }).then((res) => res.data);
  },
  upsertSchedules(id, payload) {
    return api.put(`/doctors/${id}/schedules`, payload).then((res) => res.data);
  },
  deleteSchedule(id, scheduleId) {
    return api.delete(`/doctors/${id}/schedules/${scheduleId}`).then((res) => res.data);
  },
  previewSlots(id, params) {
    return api.get(`/doctors/${id}/schedules/preview`, { params }).then((res) => res.data);
  },
  availability(id, params = {}) {
    return api.get(`/doctors/${id}/availability`, { params }).then((res) => res.data);
  },
  listLeaves(id) {
    return api.get(`/doctors/${id}/leaves`).then((res) => res.data);
  },
  createLeave(id, payload) {
    return api.post(`/doctors/${id}/leaves`, payload).then((res) => res.data);
  },
  updateLeave(id, leaveId, payload) {
    return api.patch(`/doctors/${id}/leaves/${leaveId}`, payload).then((res) => res.data);
  },
  deleteLeave(id, leaveId) {
    return api.delete(`/doctors/${id}/leaves/${leaveId}`).then((res) => res.data);
  },
};

export default doctorsApi;
