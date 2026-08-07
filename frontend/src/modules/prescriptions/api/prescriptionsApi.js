import api from '@/services/api';

export const prescriptionsApi = {
  create(payload) {
    return api.post('/prescriptions', payload).then((res) => res.data);
  },
  getById(id) {
    return api.get(`/prescriptions/${id}`).then((res) => res.data);
  },
  update(id, payload) {
    return api.patch(`/prescriptions/${id}`, payload).then((res) => res.data);
  },
  remove(id) {
    return api.delete(`/prescriptions/${id}`).then((res) => res.data);
  },
  finalize(id) {
    return api.post(`/prescriptions/${id}/finalize`).then((res) => res.data);
  },
  duplicate(id) {
    return api.post(`/prescriptions/${id}/duplicate`).then((res) => res.data);
  },
  print(id) {
    return api.get(`/prescriptions/${id}/print`).then((res) => res.data);
  },
  listByConsultation(consultationId) {
    return api.get(`/prescriptions/consultation/${consultationId}`).then((res) => res.data);
  },
  listByPatient(patientId) {
    return api.get(`/prescriptions/patient/${patientId}`).then((res) => res.data);
  },
  listByDoctor(params) {
    return api.get('/prescriptions/doctor', { params }).then((res) => res.data);
  },
  recentMedicines(doctorId) {
    return api.get('/prescriptions/recent-medicines', { params: { doctorId } }).then((res) => res.data);
  },
  listTemplates(doctorId) {
    return api.get('/prescriptions/templates', { params: { doctorId } }).then((res) => res.data);
  },
  createTemplate(payload) {
    return api.post('/prescriptions/templates', payload).then((res) => res.data);
  },
  applyTemplate(id, consultationId) {
    return api
      .post(`/prescriptions/templates/${id}/apply`, { consultationId })
      .then((res) => res.data);
  },
  searchMedicines(q, limit = 20) {
    return api
      .get('/prescriptions/medicines/search', { params: { q, limit } })
      .then((res) => res.data);
  },
  listMedicines(params) {
    return api.get('/prescriptions/medicines', { params }).then((res) => res.data);
  },
};

export default prescriptionsApi;
