import api from '@/services/api';

export const appointmentsApi = {
  list(params = {}) {
    return api.get('/appointments', { params }).then((res) => res.data);
  },
  getById(id) {
    return api.get(`/appointments/${id}`).then((res) => res.data);
  },
  create(payload) {
    return api.post('/appointments', payload).then((res) => res.data);
  },
  update(id, payload) {
    return api.patch(`/appointments/${id}`, payload).then((res) => res.data);
  },
  availableSlots(params) {
    return api.get('/appointments/available-slots', { params }).then((res) => res.data);
  },
  doctorCalendar(params) {
    return api.get('/appointments/doctor-calendar', { params }).then((res) => res.data);
  },
  patientHistory(patientId) {
    return api.get(`/appointments/patient/${patientId}/history`).then((res) => res.data);
  },
  confirm(id) {
    return api.post(`/appointments/${id}/confirm`).then((res) => res.data);
  },
  cancel(id, payload = {}) {
    return api.post(`/appointments/${id}/cancel`, payload).then((res) => res.data);
  },
  noShow(id, payload = {}) {
    return api.post(`/appointments/${id}/no-show`, payload).then((res) => res.data);
  },
  complete(id) {
    return api.post(`/appointments/${id}/complete`).then((res) => res.data);
  },
  reschedule(id, payload) {
    return api.post(`/appointments/${id}/reschedule`, payload).then((res) => res.data);
  },
  followUp(id, payload) {
    return api.post(`/appointments/${id}/follow-up`, payload).then((res) => res.data);
  },
  decideApproval(id, payload) {
    return api.post(`/appointments/${id}/approval`, payload).then((res) => res.data);
  },
  acceptAlternative(id) {
    return api.post(`/appointments/${id}/accept-alternative`).then((res) => res.data);
  },
  remove(id) {
    return api.delete(`/appointments/${id}`).then((res) => res.data);
  },
};

export default appointmentsApi;
