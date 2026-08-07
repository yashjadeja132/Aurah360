import api from '@/services/api';

export const receptionApi = {
  dashboard(params) {
    return api.get('/reception/dashboard', { params }).then((res) => res.data);
  },
  todaysAppointments(params) {
    return api.get('/reception/appointments/today', { params }).then((res) => res.data);
  },
  checkIn(appointmentId, payload = {}) {
    return api.post(`/reception/check-in/${appointmentId}`, payload).then((res) => res.data);
  },
  undoCheckIn(appointmentId) {
    return api.post(`/reception/undo-check-in/${appointmentId}`).then((res) => res.data);
  },
  walkIn(payload) {
    return api.post('/reception/walk-in', payload).then((res) => res.data);
  },
};

export default receptionApi;
