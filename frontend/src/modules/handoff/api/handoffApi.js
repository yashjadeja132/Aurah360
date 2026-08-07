import api from '@/services/api';

export const handoffApi = {
  create(payload) {
    return api.post('/handoff', payload).then((r) => r.data);
  },
  listForPatient(patientId) {
    return api.get(`/handoff/patients/${patientId}`).then((r) => r.data);
  },
  listUnacknowledgedForDoctor(doctorId) {
    return api.get(`/handoff/doctors/${doctorId}/unacknowledged`).then((r) => r.data);
  },
  acknowledge(id, payload) {
    return api.post(`/handoff/${id}/acknowledge`, payload).then((r) => r.data);
  },
  amend(id, payload) {
    return api.post(`/handoff/${id}/amend`, payload).then((r) => r.data);
  },
};

export default handoffApi;
