import api from '@/services/api';

export const patientsApi = {
  list(params = {}) {
    return api.get('/patients', { params }).then((res) => res.data);
  },
  getById(id) {
    return api.get(`/patients/${id}`).then((res) => res.data);
  },
  create(payload) {
    return api.post('/patients', payload).then((res) => res.data);
  },
  update(id, payload) {
    return api.patch(`/patients/${id}`, payload).then((res) => res.data);
  },
  updateConsent(id, payload) {
    return api.patch(`/patients/${id}/consent`, payload).then((res) => res.data);
  },
  remove(id) {
    return api.delete(`/patients/${id}`).then((res) => res.data);
  },
  checkDuplicates(payload) {
    return api.post('/patients/duplicates/check', payload).then((res) => res.data);
  },
  listDocuments(id) {
    return api.get(`/patients/${id}/documents`).then((res) => res.data);
  },
  uploadDocument(id, formData) {
    return api
      .post(`/patients/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data);
  },
  renameDocument(id, documentId, title) {
    return api
      .patch(`/patients/${id}/documents/${documentId}`, { title })
      .then((res) => res.data);
  },
  deleteDocument(id, documentId) {
    return api.delete(`/patients/${id}/documents/${documentId}`).then((res) => res.data);
  },
  timeline(id, params = {}) {
    return api.get(`/patients/${id}/timeline`, { params }).then((res) => res.data);
  },
};

export default patientsApi;
