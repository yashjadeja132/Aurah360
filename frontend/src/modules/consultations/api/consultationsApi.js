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
  runPrecheck(id) {
    return api.post(`/consultations/${id}/precheck`).then((res) => res.data);
  },
  patientPhotos(id) {
    return api.get(`/consultations/${id}/patient-photos`).then((r) => r.data);
  },
  uploadPhoto(id, formData) {
    return api
      .post(`/consultations/${id}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data);
  },
  /** IMG-005 — photoId is global, not consultation-scoped (mirrors the verify-consent route). */
  releasePhoto(photoId, visibility) {
    return api.post(`/consultations/photos/${photoId}/release`, { visibility }).then((res) => res.data);
  },
  listLabOrders(id) {
    return api.get(`/consultations/${id}/lab-orders`).then((res) => res.data);
  },
  labOrderReviewQueue(params) {
    return api.get('/consultations/lab-orders/review-queue', { params }).then((res) => res.data);
  },
  createLabOrder(id, payload) {
    return api.post(`/consultations/${id}/lab-orders`, payload).then((res) => res.data);
  },
  updateLabOrder(id, labOrderId, payload) {
    return api
      .patch(`/consultations/${id}/lab-orders/${labOrderId}`, payload)
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
