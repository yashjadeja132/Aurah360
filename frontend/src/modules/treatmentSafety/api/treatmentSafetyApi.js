import api from '@/services/api';

export const treatmentSafetyApi = {
  recordPatchTest(payload) {
    return api.post('/treatment-safety/patch-tests', payload).then((r) => r.data);
  },
  reviewPatchTest(id, payload) {
    return api.post(`/treatment-safety/patch-tests/${id}/review`, payload).then((r) => r.data);
  },
  listPatchTestsForPatient(patientId) {
    return api.get(`/treatment-safety/patch-tests/patients/${patientId}`).then((r) => r.data);
  },
  reportAdverseEvent(payload) {
    return api.post('/treatment-safety/adverse-events', payload).then((r) => r.data);
  },
  listAdverseEvents(params) {
    return api.get('/treatment-safety/adverse-events', { params }).then((r) => r.data);
  },
  updateAdverseEvent(id, payload) {
    return api.patch(`/treatment-safety/adverse-events/${id}`, payload).then((r) => r.data);
  },
  closeAdverseEvent(id, payload) {
    return api.post(`/treatment-safety/adverse-events/${id}/close`, payload).then((r) => r.data);
  },
};

export default treatmentSafetyApi;
