import api from '@/services/api';

export const consultationsApi = {
  start(payload) {
    return api.post('/consultations', payload).then((res) => res.data);
  },
  getWorkspace(id) {
    return api.get(`/consultations/${id}/workspace`).then((res) => res.data);
  },
  getById(id) {
    return api.get(`/consultations/${id}`).then((res) => res.data);
  },
  listByPatient(patientId) {
    return api.get(`/consultations/patient/${patientId}`).then((res) => res.data);
  },
  listByDoctor(params) {
    return api.get('/consultations/doctor', { params }).then((res) => res.data);
  },
  patientSummary(patientId) {
    return api.get(`/consultations/patient/${patientId}/summary`).then((res) => res.data);
  },
  update(id, payload) {
    return api.patch(`/consultations/${id}`, payload).then((res) => res.data);
  },
  sign(id) {
    return api.post(`/consultations/${id}/sign`).then((res) => res.data);
  },
  lock(id) {
    return api.post(`/consultations/${id}/lock`).then((res) => res.data);
  },
  unlock(id) {
    return api.post(`/consultations/${id}/unlock`).then((res) => res.data);
  },
  autosaveSoap(id, payload) {
    return api.post(`/consultations/${id}/soap/autosave`, payload).then((res) => res.data);
  },
  soapVersions(id) {
    return api.get(`/consultations/${id}/soap/versions`).then((res) => res.data);
  },
  saveVitals(id, payload) {
    return api.put(`/consultations/${id}/vitals`, payload).then((res) => res.data);
  },
  saveDiagnosis(id, payload) {
    return api.put(`/consultations/${id}/diagnosis`, payload).then((res) => res.data);
  },
  saveExamination(id, payload) {
    return api.put(`/consultations/${id}/examination`, payload).then((res) => res.data);
  },
  listPhotos(id) {
    return api.get(`/consultations/${id}/photos`).then((res) => res.data);
  },
  uploadPhoto(id, formData) {
    return api
      .post(`/consultations/${id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data);
  },
  listTemplates(params) {
    return api.get('/consultations/templates', { params }).then((res) => res.data);
  },
  createTemplate(payload) {
    return api.post('/consultations/templates', payload).then((res) => res.data);
  },
};

export default consultationsApi;
